// The one module that imports the platform: the tests resolve `react-native` to a stand-in.
export {
  AccessibilityInfo as platformAccessibility,
  Appearance as platformAppearance,
  Dimensions as platformDimensions,
  Pressable as platformPressable,
  StyleSheet as platformStyleSheet,
} from 'react-native'
