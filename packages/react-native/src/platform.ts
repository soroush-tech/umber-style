// The one module that imports the platform: the tests resolve `react-native` to a stand-in.
export { Appearance as platformAppearance, StyleSheet as platformStyleSheet } from 'react-native'
