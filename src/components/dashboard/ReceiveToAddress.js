// @flow
import React from 'react'
import { View } from 'react-native'
import GoodWallet from '../../lib/wallet/GoodWallet'
import InputText from '../common/form/InputText'
import { Section, Text, Wrapper } from '../common'
import TopBar from '../common/view/TopBar'
import { withStyles } from '../../lib/styles'
import { getDesignRelativeHeight } from '../../lib/utils/sizes'
import normalize from '../../lib/utils/normalizeText'
import Illustration from '../../assets/Signup/maginLinkIllustration.svg'
import CopyButton from '../common/buttons/CopyButton'
import useOnPress from '../../lib/hooks/useOnPress'

export type TypeProps = {
  screenProps: any,
  navigation: any,
  styles: any,
}

const { account } = GoodWallet

const ReceiveToAddress = ({ screenProps, styles, address }: TypeProps) => {
  const onPressDone = useOnPress(screenProps.goToRoot, [screenProps.goToRoot])
  return (
    <Wrapper>
      <TopBar push={screenProps.push} hideProfile={false}>
        <View />
      </TopBar>
      <Section grow justifyContent="space-between">
        <Section.Title fontWeight="medium">YOUR WALLET ADDRESS:</Section.Title>
        <InputText
          containerStyle={styles.containerInput}
          style={styles.input}
          value={address || account}
          editable={false}
        />
        <Text fontSize={24} fontWeight="medium" lineHeight={30}>
          {'You can copy and share it\nwith others'}
        </Text>
        <View style={styles.illustration}>
          <Illustration />
        </View>
        <CopyButton style={styles.confirmButton} toCopy={address || account} onPressDone={onPressDone} />
      </Section>
    </Wrapper>
  )
}

ReceiveToAddress.navigationOptions = {
  title: 'Receive G$',
}

export default withStyles(({ theme }) => ({
  containerInput: {
    flex: 0,
    marginTop: getDesignRelativeHeight(25),
    marginBottom: getDesignRelativeHeight(33),
    marginHorizontal: getDesignRelativeHeight(10),
  },
  input: {
    fontSize: normalize(13.5),
    fontFamily: 'Roboto Slab',
  },
  illustration: {
    flexGrow: 1,
    flexShrink: 0,
    maxHeight: getDesignRelativeHeight(230),
    minHeight: getDesignRelativeHeight(140),
    marginTop: getDesignRelativeHeight(15),
    marginBottom: getDesignRelativeHeight(15),
  },
}))(ReceiveToAddress)
