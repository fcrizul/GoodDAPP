// @flow
import { assign, debounce, forIn, get, isEmpty, isString, pick, remove, toLower } from 'lodash'
import { isMobileReactNative } from '../utils/platform'
import { LogEvent } from '../logger/pino-logger'
import { ExceptionCategory } from '../logger/exceptions'
import { ERROR_LOG } from './constants'

const savedErrorMessages = new WeakMap()

export class AnalyticsClass {
  apis = {}

  constructor(apis, rootApi, Config, loggerApi) {
    const { sentryDSN, amplitudeKey, env } = Config
    const { amplitude, sentry, fullStory } = apis
    const logger = loggerApi.child({ from: 'analytics' })
    const options = pick(Config, 'sentryDSN', 'amplitudeKey', 'version', 'env', 'phase')

    assign(this.apis, apis)
    assign(this, options, { logger, rootApi, loggerApi })

    this.isSentryEnabled = !(!sentry || !sentryDSN)
    this.isAmplitudeEnabled = !(!amplitude || !amplitudeKey)
    this.isFullStoryEnabled = !(!fullStory || env !== 'production')
  }

  initAnalytics = async () => {
    const { apis, version, network, logger, sentryDSN, env, phase } = this
    const { isSentryEnabled, isAmplitudeEnabled, isFullStoryEnabled, amplitudeKey } = this
    const { fullStory, amplitude, sentry, mautic, googleAnalytics } = apis

    if (fullStory && !isFullStoryEnabled) {
      fullStory.onReady(() => fullStory.shutdown())
    }

    if (isAmplitudeEnabled) {
      logger.info('preinitializing Amplitude with license key')

      const success = await this.initAmplitude(amplitudeKey)

      this.isAmplitudeEnabled = success
      logger.info('License sent to Amplitude', { success })

      const identity = new amplitude.Identify().setOnce('first_open_date', new Date().toString())

      identity.append('phase', String(phase))
      amplitude.setVersionName(version)
      amplitude.identify(identity)
    }

    if (isSentryEnabled) {
      sentry.init({
        dsn: sentryDSN,
        environment: env,
      })

      sentry.configureScope(scope => {
        scope.setTag('appVersion', version)
        scope.setTag('networkUsed', network)
        scope.setTag('phase', phase)
      })
    }

    logger.debug('available analytics:', {
      FS: isFullStoryEnabled,
      Sentry: isSentryEnabled,
      Amplitude: isAmplitudeEnabled,
      Mautic: !!mautic,
      Google: !!googleAnalytics,
    })

    const { fireEvent, loggerApi } = this
    const debouncedFireEvent = debounce(fireEvent, 500, { leading: true })

    loggerApi.on(LogEvent.Error, (...args) => this.onErrorLogged(debouncedFireEvent, args))
  }

  identifyWith = (email, identifier = null) => {
    const { apis, version, phase, logger } = this
    const { amplitude, sentry, fullStory, mautic } = apis
    const { isAmplitudeEnabled, isSentryEnabled, isFullStoryEnabled } = this

    if (isAmplitudeEnabled && identifier) {
      amplitude.setUserId(identifier)
    }

    if (isFullStoryEnabled) {
      fullStory.identify(identifier, {
        appVersion: version,
        phase,
      })
    }

    if (isSentryEnabled) {
      sentry.configureScope(scope =>
        scope.setUser({
          id: identifier,
        }),
      )
    }

    this.setUserEmail(email)

    logger.debug(
      'Analytics services identified with:',
      { email, identifier },
      {
        FS: isFullStoryEnabled,
        Sentry: isSentryEnabled,
        Mautic: !(!mautic || !email),
        Amplitude: isAmplitudeEnabled,
      },
    )
  }

  // eslint-disable-next-line require-await
  identifyOnUserSignup = async email => {
    const { logger, apis } = this
    const { isSentryEnabled, isAmplitudeEnabled, isFullStoryEnabled } = this
    const { mautic } = apis

    this.setUserEmail(email)

    // disable for now, to see if it solves the duplicate contact issue
    // if (email && ['staging', 'production'].includes(env)) {
    //   await rootApi.addMauticContact({ email })
    // }

    logger.debug(
      'Analytics services identified during new user signup:',
      { email },
      {
        FS: isFullStoryEnabled,
        Sentry: isSentryEnabled,
        Mautic: !(!mautic || !email),
        Amplitude: isAmplitudeEnabled,
      },
    )
  }

  fireEvent = (event: string, data: any = {}) => {
    const { isAmplitudeEnabled, apis, logger, googleAnalytics } = this
    const { amplitude } = apis

    if (isAmplitudeEnabled) {
      if (!amplitude.logEvent(event, data)) {
        logger.warn('Amplitude event not sent', { event, data })
      }
    }

    //fire all events on  GA also
    let gaEvent
    if (googleAnalytics) {
      gaEvent = this.convertToGA(data)
      gaEvent.eventAction = 'event'
      this.fireGoogleAnalyticsEvent('Analytics_event', gaEvent)
    }

    logger.debug('fired event', { event, data, gaEvent })
  }

  convertToGA = (data: any = {}) => {
    const values = Object.values(data)
    const eventValues = remove(values, x => typeof x === 'number')
    const eventStrings = remove(values, x => typeof x === 'string')
    const gaEvent = {
      eventValue: eventValues.shift(),
      eventLabel: eventStrings.shift() || eventValues.shift() || JSON.stringify(values.shift()),
    }
    return gaEvent
  }

  fireMauticEvent = (data: any = {}) => {
    const { mautic } = this.apis

    if (!mautic) {
      return
    }

    const { userId } = mautic
    let eventData = data

    if (userId) {
      // do not mutate source params
      eventData = { ...data, email: userId }
    }

    mautic('send', 'pageview', eventData)
  }

  /**
   * Create code from navigation active route and call `fireEvent`
   * @param {object} route
   */
  fireEventFromNavigation = route => {
    const { routeName: key, params } = route
    const action = get(params, 'action', 'GOTO')
    const code = `${action}_${key}`.toUpperCase()

    this.fireEvent(code)
  }

  /**
   * fire event to google analytics
   *
   * @param {string} event Event name
   * @param {object} data Event properties (optional)
   * @return {void}
   */
  fireGoogleAnalyticsEvent = (event, data = {}) => {
    const { googleAnalytics } = this.apis

    if (!googleAnalytics) {
      return
    }

    googleAnalytics.push({ event, ...data })
  }

  // @private
  // eslint-disable-next-line require-await
  async initAmplitude(key) {
    const { apis, isAmplitudeEnabled } = this
    const { amplitude } = apis

    if (!isAmplitudeEnabled) {
      return
    }

    return new Promise(resolve => {
      const onError = () => resolve(false)
      const onSuccess = () => resolve(true)

      amplitude.init(key, null, { includeReferrer: true, includeUtm: true, onError }, onSuccess)
    })
  }

  /** @private */
  setUserEmail(email) {
    const { isAmplitudeEnabled, isSentryEnabled, isFullStoryEnabled, apis } = this
    const { amplitude, sentry, fullStory, mautic } = apis

    if (!email) {
      return
    }

    if (isAmplitudeEnabled) {
      amplitude.setUserProperties({ email })
    }

    if (isFullStoryEnabled) {
      fullStory.setUserVars({ email })
    }

    if (isSentryEnabled) {
      sentry.configureScope(scope => {
        const { _user } = scope

        scope.setUser({ ...(_user || {}), email })
      })
    }

    if (mautic) {
      mautic.userId = email
    }
  }

  // @private
  reportToSentry(error, extra = {}, tags = {}) {
    const { apis, isSentryEnabled, logger } = this
    const { sentry } = apis

    if (!isSentryEnabled) {
      return
    }

    const { logContext, eMsg } = extra
    const fingerprint = [get(logContext, 'from', '{{ default }}'), eMsg]

    sentry.configureScope(scope => {
      const extraTags = []
      const tagsSet = []

      // set extra
      forIn(extra, (value, key) => {
        extraTags.push(key)
        scope.setExtra(key, value)
      })

      // set tags
      forIn(tags, (value, key) => {
        tagsSet.push(key)
        scope.setTag(key, value)
      })

      scope.setFingerprint(fingerprint)
      sentry.captureException(error)

      logger.debug('Captured Sentry exception', { fingerprint, tags: tagsSet, extraTags })
    })
  }

  // @private
  onErrorLogged(fireEvent, args) {
    const { apis, isSentryEnabled, isFullStoryEnabled, env } = this
    const { sentry, fullStory } = apis
    const isRunningTests = env === 'test'
    const { Unexpected, Network, Human } = ExceptionCategory
    const [logContext, logMessage, eMsg = '', errorObj, extra = {}] = args
    const debouncedFireEvent = debounce(fireEvent, 500, { leading: true })
    let { dialogShown, category = Unexpected, ...context } = extra
    let categoryToPassIntoLog = category
    let sessionUrlAtTime

    if (isFullStoryEnabled && fullStory.ready) {
      sessionUrlAtTime = fullStory.getCurrentSessionURL(true)
    }

    if (isString(eMsg) && !isEmpty(eMsg)) {
      const lowerCased = toLower(eMsg)

      if (
        categoryToPassIntoLog === Unexpected &&
        ['connection', 'websocket', 'network'].some(str => lowerCased.includes(str))
      ) {
        categoryToPassIntoLog = Network
      }
    }

    if (isString(logMessage) && !logMessage.includes('axios')) {
      debouncedFireEvent(ERROR_LOG, {
        unique: `${eMsg} ${logMessage} (${logContext.from})`,
        reason: logMessage,
        logContext,
        eMsg,
        dialogShown,
        category: categoryToPassIntoLog,
        context,
        sessionUrlAtTime,
      })
    }

    if (!isSentryEnabled || isRunningTests) {
      return
    }

    let errorToPassIntoLog = errorObj

    if (errorObj instanceof Error) {
      savedErrorMessages.set(errorObj, errorObj.message)
      errorToPassIntoLog.message = `${logMessage}: ${errorObj.message}`
    } else {
      errorToPassIntoLog = new Error(logMessage)
    }

    this.reportToSentry(
      errorToPassIntoLog,
      {
        logMessage,
        errorObj,
        logContext,
        eMsg,
        context,
        sessionUrlAtTime,
      },
      {
        dialogShown,
        category: categoryToPassIntoLog,
        level: categoryToPassIntoLog === Human ? 'info' : undefined,
      },
    )

    // there's no Sentry.flush() on react-native
    if (isMobileReactNative) {
      return
    }

    sentry.flush().finally(() => {
      // if savedErrorMessage not empty that means errorObj
      // was an Error instrance and we mutated its message
      // so we have to restore it now
      if (savedErrorMessages.has(errorObj)) {
        errorObj.message = savedErrorMessages.get(errorObj)
      }
    })
  }
}
