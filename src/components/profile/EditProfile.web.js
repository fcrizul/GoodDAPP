import React, { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import { CustomButton, Section, UserAvatar, Wrapper } from '../common'
import GDStore from '../../lib/undux/GDStore'
import { useWrappedUserStorage } from '../../lib/gundb/useWrappedStorage'
import { useErrorDialog } from '../../lib/undux/utils/dialog'
import ProfileDataTable from './ProfileDataTable'

const TITLE = 'Edit Profile'

const EditProfile = props => {
  const store = GDStore.useStore()
  const userStorage = useWrappedUserStorage()

  const [profile, setProfile] = useState(store.get('profile'))
  const [saving, setSaving] = useState()
  const [isValid, setIsValid] = useState()
  const [errors, setErrors] = useState({})
  const [showErrorDialog] = useErrorDialog()
  useEffect(() => {
    userStorage.getPrivateProfile(profile).then(setProfile)
  }, [profile.fullName])

  const validate = async () => {
    const { isValid, errors } = profile.validate()
    const { isValid: indexIsValid, errors: indexErrors } = await userStorage.validateProfile(profile)
    setErrors({ ...errors, ...indexErrors })
    setIsValid(isValid && indexIsValid)
    return isValid && indexIsValid
  }

  const handleSaveButton = async () => {
    setSaving(true)
    const isValid = await validate()

    if (!isValid) {
      return
    }

    userStorage
      .setProfile(profile)
      .catch(showErrorDialog)
      .finally(r => {
        setSaving(false)
      })
    props.screenProps.pop()
  }

  // Validate after saving profile state in order to show errors
  useEffect(() => {
    validate()
  }, [profile])

  return (
    <Wrapper>
      <Section style={styles.section}>
        <Section.Row style={styles.centered}>
          <UserAvatar onChange={setProfile} editable={true} profile={profile} />
          <CustomButton
            disabled={saving || !isValid}
            loading={saving}
            mode="outlined"
            style={styles.saveButton}
            onPress={handleSaveButton}
          >
            Save
          </CustomButton>
        </Section.Row>
        <ProfileDataTable onChange={setProfile} editable={true} errors={errors} profile={profile} />
      </Section>
    </Wrapper>
  )
}

EditProfile.navigationOptions = {
  title: TITLE
}

const styles = StyleSheet.create({
  section: {
    paddingLeft: '1em',
    paddingRight: '1em'
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'flex-start'
  },
  saveButton: {
    position: 'absolute',
    top: 0,
    right: 0
  }
})

export default EditProfile
