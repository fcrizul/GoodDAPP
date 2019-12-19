// @flow
import { isMobile } from 'mobile-device-detect'
import React from 'react'
import PhoneInput from 'react-phone-number-input'
import debounce from 'lodash/debounce'
import './PhoneForm.css'
import { getScreenWidth } from '../../lib/utils/Orientation'
import { getDesignRelativeHeight } from '../../lib/utils/sizes'
import { userModelValidations } from '../../lib/gundb/UserModel'
import logger from '../../lib/logger/pino-logger'
import SimpleStore from '../../lib/undux/SimpleStore'
import { withStyles } from '../../lib/styles'
import Config from '../../config/config'
import { getFirstWord } from '../../lib/utils/getFirstWord'
import Section from '../common/layout/Section'
import ErrorText from '../common/form/ErrorText'
import CustomWrapper from './signUpWrapper'

const log = logger.child({ from: 'PhoneForm' })

type Props = {
  doneCallback: ({ phone: string }) => null,
  screenProps: any,
  navigation: any,
}

export type MobileRecord = {
  mobile: string,
  errorMessage?: string,
  countryCode?: string | null,
  isValid: boolean,
}

type State = MobileRecord

class PhoneForm extends React.Component<Props, State> {
  state = {
    mobile: this.props.screenProps.data.mobile || '',
    errorMessage: '',
    countryCode: this.props.screenProps.data.countryCode,
    isValid: true,
    downDescription: false,
  }

  onFocus = () => {
    const { store } = this.props
    if (isMobile) {
      store.set('isMobileKeyboardShown')(true)
      this.setState({
        downDescription: true,
      })
    }
  }

  onBlur = () => {
    const { store } = this.props
    if (isMobile) {
      store.set('isMobileKeyboardShown')(false)
      this.setState({
        downDescription: false,
      })
    }
  }

  componentDidUpdate() {
    if (this.props.screenProps.data.countryCode !== this.state.countryCode) {
      this.setState({
        countryCode: this.props.screenProps.data.countryCode,
      })
    }
  }

  handleChange = (mobile: string) => {
    this.checkErrorsSlow()

    this.setState({ mobile })
  }

  handleSubmit = async () => {
    const isValid = await this.checkErrors()
    if (isValid) {
      this.props.screenProps.doneCallback({ mobile: this.state.mobile })
    }
  }

  handleEnter = (event: { nativeEvent: { key: string } }) => {
    if (event.keyCode === 13 && this.state.isValid) {
      this.handleSubmit()
    }
  }

  checkErrors = () => {
    const modelErrorMessage = userModelValidations.mobile(this.state.mobile)
    const errorMessage = modelErrorMessage
    log.debug({ modelErrorMessage, errorMessage, Config })
    this.setState({ errorMessage, isValid: errorMessage === '' })
    return errorMessage === ''
  }

  checkErrorsSlow = debounce(this.checkErrors, 500)

  render() {
    const errorMessage = this.state.errorMessage || this.props.screenProps.error
    this.props.screenProps.error = undefined

    const { key } = this.props.navigation.state
    const { styles } = this.props
    const { downDescription } = this.state
    const { fullName, loading } = this.props.screenProps.data

    return (
      <CustomWrapper valid={this.state.isValid} handleSubmit={this.handleSubmit} loading={loading}>
        <Section grow justifyContent="flex-start">
          <Section.Stack justifyContent="flex-start" style={styles.container}>
            <Section.Row justifyContent="center">
              <Section.Title color="darkGray" fontSize={22} fontWeight="500" textTransform="none">
                {`${getFirstWord(fullName)},\nenter your phone number\nso we could verify you`}
              </Section.Title>
            </Section.Row>
            <Section.Stack justifyContent="center" style={styles.column}>
              <PhoneInput
                id={key + '_input'}
                value={this.state.mobile}
                onChange={this.handleChange}
                error={errorMessage}
                onKeyDown={this.handleEnter}
                country={this.state.countryCode}
                onFocus={this.onFocus}
                onBlur={this.onBlur}
              />
              <ErrorText error={errorMessage} style={styles.customError} />
            </Section.Stack>
          </Section.Stack>
          <Section.Row justifyContent="center" style={[styles.bottomRow, { top: downDescription ? 50 : 0 }]}>
            <Section.Text fontSize={14} color="gray80Percent">
              A verification code will be sent to this number
            </Section.Text>
          </Section.Row>
        </Section>
      </CustomWrapper>
    )
  }
}

const getStylesFromProps = ({ theme }) => ({
  column: {
    marginBottom: theme.sizes.default,
    marginTop: 'auto',
  },
  customError: {
    marginLeft: 48,
  },
  container: {
    minHeight: getDesignRelativeHeight(200),
    height: getDesignRelativeHeight(200),
    width: getScreenWidth() > 350 ? '100%' : '250px',
  },
  bottomRow: {
    marginTop: 'auto',
  },
})

export default withStyles(getStylesFromProps)(SimpleStore.withStore(PhoneForm))
