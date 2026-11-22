/**
 * The props that a string tag receives by default, under the names React gives them: the attributes of
 * the HTML and SVG specifications (global, of each element, RDFa and microdata, SVG presentation, filter
 * and animation attributes) and React's own (`children`, `ref`, `key`, `dangerouslySetInnerHTML`,
 * `defaultValue`, `suppressHydrationWarning` and the rest). `data-*`, `aria-*` and `on[A-Z]*` are matched
 * by their start. Written in groups: `head:a,b` stands for `heada` and `headb`, an empty tail for `head`.
 */
const NAMES =
  'abbr about accept:,Charset accessKey action allow:,FullScreen alt async ' +
  'auto:Capitalize,Complete,Correct,Focus,Play blocking capture charSet checked children cite closedBy ' +
  'col:s,Span command:,For content:,Editable controls:,List coords crossOrigin ' +
  'dangerouslySetInnerHTML data datatype dateTime decoding default:,Checked,Value defer dir:,Name ' +
  'disable:d,PictureInPicture,RemotePlayback download draggable encType enterKeyHint exportParts ' +
  'fetchPriority form:,Action,EncType,Method,NoValidate,Target headers height hidden high href:,Lang ' +
  'htmlFor httpEquiv id image:Rendering,Sizes,SrcSet inert inlist inputMode integrity is isMap ' +
  'item:ID,Prop,Ref,Scope,Type key kind label lang list loading loop low max:,Length media method ' +
  'min:,Length multiple muted name noModule nonce noValidate open optimum part ping placeholder ' +
  'playsInline popover:,Target,TargetAction poster precedence prefix preload property readOnly ref ' +
  'referrerPolicy rel required resource rev reversed role rowSpan rows sandbox scope selected ' +
  'shadowRoot:Clonable,DelegatesFocus,Mode,Serializable shape size:,s slot span spellCheck ' +
  'src:,Doc,Lang,Set start step suppress:ContentEditableWarning,HydrationWarning tabIndex title ' +
  'translate type typeof useMap value vocab width wrap writingSuggestions ' +
  // SVG
  'accumulate additive alignmentBaseline amplitude attribute:Name,Type azimuth baseFrequency ' +
  'baselineShift begin bias by calcMode clip:,Path,PathUnits,Rule ' +
  'color:,Interpolation,InterpolationFilters cursor cx cy d diffuseConstant direction display divisor ' +
  'dominantBaseline dur dx dy edgeMode elevation end exponent fill:,Opacity,Rule filter:,Units ' +
  'flood:Color,Opacity focusable font:Family,Size,SizeAdjust,Stretch,Style,Variant,Weight fr from fx ' +
  'fy gradient:Transform,Units in:,2,tercept k:,1,2,3,4,ernelMatrix,ernelUnitLength ' +
  'key:Points,Splines,Times lengthAdjust letterSpacing lightingColor limitingConeAngle ' +
  'marker:End,Height,Mid,Start,Units,Width mask:,ContentUnits,Type,Units mode numOctaves offset ' +
  'opacity operator order orient overflow paintOrder pathLength pattern:,ContentUnits,Transform,Units ' +
  'pointerEvents points:,AtX,AtY,AtZ preserve:Alpha,AspectRatio primitiveUnits r radius refX refY ' +
  'repeat:Count,Dur requiredExtensions restart result rotate rx ry scale seed shapeRendering side ' +
  'slope spacing specular:Constant,Exponent spreadMethod startOffset stdDeviation stitchTiles ' +
  'stop:Color,Opacity stroke:,Dasharray,Dashoffset,Linecap,Linejoin,Miterlimit,Opacity,Width ' +
  'surfaceScale systemLanguage tableValues target:,X,Y text:Anchor,Decoration,Length,Rendering to ' +
  'transform:,Origin unicodeBidi values vectorEffect viewBox visibility wordSpacing writingMode ' +
  'x:,1,2,ChannelSelector xlink:Actuate,Arcrole,Href,Role,Show,Title,Type ' +
  'xml:Base,Lang,Space,ns,nsXlink y:,1,2,ChannelSelector z'

const PREFIXED = /^(?:data-|aria-|on[A-Z])/

let names: ReadonlySet<string> | undefined

/** The names that `groups` stands for. */
function expand(groups: string): ReadonlySet<string> {
  const expanded = new Set<string>()
  for (const group of groups.split(' ')) {
    const [head, tails] = group.split(':')
    if (tails === undefined) expanded.add(head)
    else for (const tail of tails.split(',')) expanded.add(head + tail)
  }
  return expanded
}

/** Whether a string tag receives `prop` when its component has no `shouldForwardProp`: an attribute of HTML or SVG, a `data-` or `aria-` attribute, an event handler, or a prop of React's own. */
export function isDomProp(prop: string): boolean {
  names ??= expand(NAMES)
  return names.has(prop) || PREFIXED.test(prop)
}
