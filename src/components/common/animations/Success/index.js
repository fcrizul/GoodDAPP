import React from 'react'
import Lottie from 'lottie-react-native'
import { Platform, View } from 'react-native'
import { getDesignRelativeHeight } from '../../../../lib/utils/sizes'
import AnimationBase from '../Base'
import { getAnimationData } from '../../../../lib/utils/lottie'
const { animationData, imageAssetsFolder } = getAnimationData('Success', require('./data'))

const styles = {
  android: {
    width: 200,
    height: 'auto',
    position: 'absolute',
  },
  ios: {
    width: 200,
    height: 'auto',
    position: 'absolute',
  },
  web: {
    height: 200,
  },
}
const stylesBlock = {
  android: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ios: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  web: {
    height: 'auto',
    marginBottom: getDesignRelativeHeight(20),
  },
}

class Success extends AnimationBase {
  render() {
    return (
      <View style={Platform.select(stylesBlock)}>
        <Lottie
          imageAssetsFolder={imageAssetsFolder}
          enableMergePathsAndroidForKitKatAndAbove={true}
          autoPlay={true}
          source={this.improveAnimationData(animationData)}
          style={Platform.select(styles)}
          loop={false}
          resizeMode="cover"
        />
      </View>
    )
  }
}

export default Success
