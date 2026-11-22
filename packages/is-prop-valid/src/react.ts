import { createPropFilter } from './propFilter'
import { WEB_NAMES } from './webNames'

// The names of React that Vue spells otherwise: the SVG presentation attributes in camelCase
// (`strokeWidth`), the HTML attributes React writes in camelCase where the DOM does not
// (`autoPlay`, `srcSet`, `spellCheck`), React's own props (`children`, `dangerouslySetInnerHTML`,
// `suppressHydrationWarning`, `precedence`), and the older spellings apps forward today
// (`valueLink`, `allowTransparency`, `fallback`). Written in groups (`expandNames`).
const REACT_NAMES =
  'accentHeight alignmentBaseline allow:FullScreen,PaymentRequest,Transparency,UserMedia ' +
  'arabicForm auto:Capitalize,Complete,Correct,Play,Save baselineShift capHeight charSet ' +
  'children classID clip:Path,Rule color:Interpolation,InterpolationFilters,Profile,Rendering ' +
  'commandFor contextMenu controlsList dangerouslySetInnerHTML dominantBaseline enableBackground ' +
  'encType exportParts fallback fill:Opacity,Rule flood:Color,Opacity ' +
  'font:Family,Size,SizeAdjust,Stretch,Style,Variant,Weight formEncType ' +
  'glyph:Name,OrientationHorizontal,OrientationVertical horiz:AdvX,OriginX hrefLang ' +
  'image:Rendering,SrcSet incremental item:ID,Prop,Ref,Scope,Type key:Params,Type letterSpacing ' +
  'lightingColor marker:End,Mid,Start maskType mediaGroup on option overline:Position,Thickness ' +
  'paintOrder panose1 pointerEvents popoverTarget precedence profile radioGroup shapeRendering ' +
  'spellCheck src:Doc,Lang,Set stop:Color,Opacity strikethrough:Position,Thickness ' +
  'stroke:Dasharray,Dashoffset,Linecap,Linejoin,Miterlimit,Opacity,Width ' +
  'suppress:ContentEditableWarning,HydrationWarning text:Anchor,Decoration,Rendering ' +
  'transformOrigin underline:Position,Thickness unicode:Bidi,Range unitsPerEm ' +
  'v:Alphabetic,Hanging,Ideographic,Mathematical valueLink vectorEffect ' +
  'vert:AdvY,OriginX,OriginY wordSpacing writingMode xHeight xml:Base,Lang,Space'

// `data-` and `aria-` in any case (an HTML attribute name is not case-sensitive), `x-`, and an event
// handler: `on` and any character whose code is below 91 (`[`), so an upper-case letter as in
// `onClick`, and also a digit, `-`, `:` or `@` (`on-click`, `on1`), which the predicate apps use today
// accepts too. The class names what it leaves out, `[` (code 91) to the last code unit, so that it
// names no control character.
const PREFIXED = /^(?:[Dd][Aa][Tt][Aa]-|[Aa][Rr][Ii][Aa]-|x-|on[^\x5b-￿])/

/**
 * Whether `prop` is a prop that React writes to an HTML or SVG element, under the name React gives it:
 * an attribute of HTML or SVG (`tabIndex`, `htmlFor`, `className`, `strokeWidth`), a `data-*`,
 * `aria-*` or `x-*` attribute, an event handler (`onClick`: `on` and any character whose code is
 * below 91, a digit, `-` and `:` included), or a prop of React's own (`children`,
 * `ref`, `key`, `style`, `dangerouslySetInnerHTML`, `defaultValue`). False for `as`, `theme` and
 * any other name.
 */
export const isPropValid = createPropFilter(`${WEB_NAMES} ${REACT_NAMES}`, PREFIXED)

// Also the default export, as the predicate apps use today is. A CommonJS build that imports this
// entry (the React binding's) reads the named export: its interop takes `module.exports` as the default.
export default isPropValid
