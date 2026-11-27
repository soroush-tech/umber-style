import * as core from './index'
import * as internal from './internal'

describe('the internal entry', () => {
  it('holds the helpers of the bindings and nothing else', () => {
    expect(Object.keys(internal).sort()).toEqual([
      'EMPTY_THEME',
      'ROOT_SELECTOR',
      'assertAlphaInput',
      'callCheckedStyle',
      'createComponentSelector',
      'createCssEntry',
      'createDeferredObject',
      'createDeferredRecord',
      'createGlobalMarker',
      'createLazyRecord',
      'createLiveValue',
      'createNoSchemeGuard',
      'createNonceAttribute',
      'createSchemeKey',
      'createScopeRule',
      'createSheetEntry',
      'createStyleSelector',
      'createThemeClass',
      'createThemeClassName',
      'createThemeGuard',
      'createThemeId',
      'createThemeKey',
      'createThemeRule',
      'declareLiveValue',
      'findCache',
      'flattenStyle',
      'getBoundaryClass',
      'getSchemeClass',
      'hashString',
      'isTemplateStrings',
      'mergeTheme',
      'parseKeyframesTemplate',
      'parseStyleTemplate',
      'readCondition',
      'readEntrySource',
      'readKeyframesSteps',
      'readNonceSource',
      'readPageNonce',
      'readSharedState',
      'readStaticTemplate',
      'readStyleArguments',
      'rejectFunctions',
      'resolveThemeInput',
      'toDeclarationText',
      'toRgba',
      'withTagShorthands',
      'writeLiveValue',
    ])
  })

  it('shares no name with the main entry', () => {
    expect(Object.keys(internal).filter((name) => name in core)).toEqual([])
  })
})
