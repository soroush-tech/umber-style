import { createPropFilter } from './propFilter'

// The props of React Native's built-in components: View, Text, Image, ImageBackground, TextInput,
// ScrollView, FlatList, SectionList, VirtualizedList, Pressable, Button, Switch, Modal,
// ActivityIndicator, KeyboardAvoidingView, SafeAreaView, RefreshControl, StatusBar and the
// TouchableOpacity, TouchableHighlight and TouchableWithoutFeedback touchables; with `testID`,
// `nativeID`, `style`, `children`, `ref` and `key`. Written in groups (`expandNames`).
const NATIVE_NAMES =
  'CellRendererComponent ItemSeparatorComponent ListEmptyComponent ListFooterComponent ' +
  'ListFooterComponentStyle ListHeaderComponent ListHeaderComponentStyle ListItemComponent ' +
  'SectionSeparatorComponent StickyHeaderComponent accessible activeOpacity adjustsFontSizeToFit ' +
  'allow:FontScaling,SwipeDismissal alt always:BounceHorizontal,BounceVertical ' +
  'android:_disableSound,_hyphenationFrequency,_ripple animated animating animationType ' +
  'auto:Capitalize,Complete,Correct,Focus ' +
  'automatically:AdjustContentInsets,AdjustKeyboardInsets,AdjustsScrollIndicatorInsets ' +
  'backdropColor barStyle behavior blockNativeResponder blur:OnSubmit,Radius bounces:,Zoom ' +
  'canCancelContentTouches cancelable capInsets caretHidden centerContent children ' +
  'clear:ButtonMode,TextOnFocus collapsable:,Children color colors columnWrapperStyle ' +
  'content:ContainerStyle,Inset,InsetAdjustmentBehavior,Offset contextMenuHidden crossOrigin ' +
  'cursorColor data:,DetectorType,DetectorTypes debug decelerationRate default:Source,Value ' +
  'delay:HoverIn,HoverOut,LongPress,PressIn,PressOut directionalLockEnabled ' +
  'disable:FullscreenUI,IntervalMomentum,KeyboardShortcuts,ScrollViewPanResponder,Virtualization ' +
  'disabled dynamicTypeRamp editable ellipsizeMode enabled enablesReturnKeyAutomatically ' +
  'endFillColor enterKeyHint ' +
  'experimental:_acceptDragAndDropTypes,_accessibilityOrder,_endDraggingSensitivityMultiplier ' +
  'extraData fadeDuration fadingEdgeLength focusable forwardedRef get:Item,ItemCount,ItemLayout ' +
  'hardwareAccelerated hasTVPreferredFocus height hidden hidesWhenStopped hitSlop horizontal ' +
  'hostRef id image:Ref,Style important:ForAccessibility,ForAutofill indicatorStyle ' +
  'initial:NumToRender,ScrollIndex inline:ImageLeft,ImagePadding innerViewRef ' +
  'input:AccessoryViewButtonLabel,AccessoryViewID,Mode internal_analyticTag invertStickyHeaders ' +
  'inverted ios_backgroundColor key:,Extractor ' +
  'keyboard:Appearance,DismissMode,ShouldPersistTaps,Type,VerticalOffset ' +
  'line:BreakModeIOS,BreakStrategyIOS loadingIndicatorSource maintainVisibleContentPosition ' +
  'max:FontSizeMultiplier,Length,ToRenderPerBatch maximumZoomScale minimum:FontScale,ZoomScale ' +
  'modalRef multiline native:BackgroundAndroid,ForegroundAndroid,ID navigationBarTranslucent ' +
  'needsOffscreenAlphaCompositing nestedScrollEnabled ' +
  'next:FocusDown,FocusForward,FocusLeft,FocusRight,FocusUp numColumns numberOfLines ' +
  'overScrollMode pagingEnabled passwordRules persistentScrollbar pinchGestureEnabled ' +
  'placeholder:,TextColor pointerEvents presentationStyle pressRetentionOffset ' +
  'progress:BackgroundColor,ViewOffset progressiveRenderingEnabled readOnly ref referrerPolicy ' +
  'refreshControl refreshing rejectResponderTermination removeClippedSubviews ' +
  'render:Item,ScrollComponent,SectionFooter,SectionHeader,ToHardwareTextureAndroid ' +
  'resize:Method,Mode,Multiplier return:KeyLabel,KeyType role rows screenReaderFocusable ' +
  'scroll:Enabled,EventThrottle,IndicatorInsets,PerfTag,ToOverflowEnabled,ViewRef ' +
  'scrolls:ChildToFocus,ToTop sections secureTextEntry selectTextOnFocus selectable ' +
  'selection:,Color,HandleColor shouldRasterizeIOS show:HideTransition,SoftInputOnFocus ' +
  'shows:HorizontalScrollIndicator,VerticalScrollIndicator size smartInsertDelete ' +
  'snap:ToAlignment,ToEnd,ToInterval,ToOffsets,ToStart source spellCheck src:,Set ' +
  'statusBarTranslucent sticky:HeaderHiddenOnScroll,HeaderIndices,SectionHeadersEnabled ' +
  'strictMode style submitBehavior supportedOrientations suppressHighlighting tabIndex ' +
  'test:ID,Only_pressed text:Align,AlignVertical,BreakStrategy,ContentType thumb:Color,TintColor ' +
  'tintColor title:,Color touchSoundDisabled trackColor transparent underlayColor ' +
  'underlineColorAndroid unstable_pressDelay updateCellsBatchingPeriod value ' +
  'viewability:Config,ConfigCallbackPairs visible width windowSize zoomScale'

// `aria-`, `accessibility` and an upper-case letter (`accessibilityLabel`), and a handler: `on` and
// an upper-case letter.
const PREFIXED = /^(?:aria-|accessibility[A-Z]|on[A-Z])/

/**
 * Whether `prop` is a prop that one of React Native's built-in components takes (`testID`,
 * `numberOfLines`, `hitSlop`, `source`, `keyboardType`), an `aria-*` or `accessibility*` prop, a
 * handler (`onPress`), or `style`, `children`, `ref` and `key`. False for `as`, `theme` and any
 * other name. A native component that is not built in takes the props it declares, which this does not
 * know.
 */
export const isPropValid = createPropFilter(NATIVE_NAMES, PREFIXED)

// Also the default export, as the predicate apps use today is. A CommonJS build that imports this
// entry (the React binding's) reads the named export: its interop takes `module.exports` as the default.
export default isPropValid
