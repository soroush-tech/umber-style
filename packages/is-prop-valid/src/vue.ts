import { createPropFilter } from './propFilter'
import { WEB_NAMES } from './webNames'

// The names of Vue that React spells otherwise: the HTML attributes in lower case (`tabindex`,
// `readonly`, `for`, `http-equiv`), the SVG presentation attributes in kebab-case (`stroke-width`),
// the attributes of the XML namespaces (`xlink:href`, `xml:lang`), the DOM properties that Vue sets by
// their name (`innerText`, `textContent`, `allowFullscreen`, `formEnctype`), and the names of Vue's
// own types (`ref_for`, `ref_key`). Written in groups (`expandNames`).
const VUE_NAMES =
  'accent-height accept-charset acceptcharset accesskey alignment-baseline allowFullscreen ' +
  'allowfullscreen allowtransparency arabic-form autocapitalize autocomplete autocorrect ' +
  'autoplay autosave baseline-shift bgColor cap-height cellpadding cellspacing charset classid ' +
  'clip:-path,-rule color:-interpolation,-interpolation-filters,-profile,-rendering colspan ' +
  'commandfor contenteditable contextmenu controlslist crossorigin datetime dirname ' +
  'disablepictureinpicture disableremoteplayback dominant-baseline enable-background enctype ' +
  'enterkeyhint fill:-opacity,-rule flood:-color,-opacity ' +
  'font:-family,-size,-size-adjust,-stretch,-style,-variant,-weight formEnctype formaction ' +
  'formenctype formmethod formnovalidate formtarget frameborder ' +
  'glyph:-name,-orientation-horizontal,-orientation-vertical horiz:-adv-x,-origin-x hreflang ' +
  'http-equiv httpequiv image:-rendering,Srcset imagesizes imagesrcset indeterminate innerText ' +
  'inputmode ismap itemid itemprop itemref itemscope itemtype keyparams keytype letter-spacing ' +
  'lighting-color marginheight marginwidth marker:-end,-mid,-start mask-type maxlength ' +
  'mediagroup minlength nomodule novalidate overline:-position,-thickness paint-order panose-1 ' +
  'playsinline pointer-events popovertarget popovertargetaction radiogroup readonly ' +
  'ref:_for,_key referrerpolicy rowspan shadowrootclonable shadowrootdelegatesfocus ' +
  'shadowrootmode shadowrootserializable shape-rendering spellcheck srcdoc srclang srcset ' +
  'stop:-color,-opacity strikethrough:-position,-thickness ' +
  'stroke:-dasharray,-dashoffset,-linecap,-linejoin,-miterlimit,-opacity,-width tabindex ' +
  'text:-anchor,-decoration,-rendering,Content transform-origin underline:-position,-thickness ' +
  'unicode:-bidi,-range units:-per-em,Per-em usemap ' +
  'v:-alphabetic,-hanging,-ideographic,-mathematical,Align vector-effect ' +
  'vert:-adv-y,-origin-x,-origin-y word-spacing writing-mode writingsuggestions x-height ' +
  'xlink::actuate,arcrole,href,role,show,title,type xml::base,lang,space xmlns::xlink'

// `data-`, `aria-`, and a listener: `on` and an upper-case letter (`onClick`, `onClickOnce`,
// `onUpdate:modelValue`).
const PREFIXED = /^(?:data-|aria-|on[A-Z])/

/**
 * Whether `prop` is a prop that Vue writes to an HTML or SVG element, as a template or a render
 * function writes it: an attribute in its HTML form (`tabindex`, `for`, `class`, `readonly`), an
 * SVG attribute in its XML form (`stroke-width`, `viewBox`, `xlink:href`), a DOM property that Vue
 * sets by its name (`tabIndex`, `innerHTML`, `textContent`), a `data-*` or `aria-*` attribute, a
 * listener (`onClick`, `onUpdate:modelValue`), or `class`, `style`, `key`, `ref` and `is`. False
 * for `as`, `theme` and any other name.
 */
export const isPropValid = createPropFilter(`${WEB_NAMES} ${VUE_NAMES}`, PREFIXED)

// Also the default export, as the predicate apps use today is. A CommonJS build that imports this
// entry (the React binding's) reads the named export: its interop takes `module.exports` as the default.
export default isPropValid
