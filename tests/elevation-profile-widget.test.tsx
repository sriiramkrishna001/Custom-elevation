import { React, getAppStore, appActions, type IMThemeVariables, Immutable, type ImmutableArray } from 'jimu-core'
import { wrapWidget, widgetRender, getInitState, getDefaultAppConfig, mockTheme } from 'jimu-for-test'
import ElevationProfileWidget from '../src/runtime/widget'
import defaultMessages from '../src/setting/translations/default'
import '@testing-library/jest-dom'
getAppStore().dispatch(appActions.updateStoreState(getInitState().merge({ appConfig: getDefaultAppConfig() })))
const Widget = wrapWidget(ElevationProfileWidget)
const render = widgetRender()

jest.mock('jimu-core', () => ({
  ...jest.requireActual<any>('jimu-core'),
  geometryUtils: {
    createBuffer: jest.fn(() => Promise.resolve({}))
  }
}))
jest.mock('esri/intl', () => { return {} }, { virtual: true })
jest.mock('esri/core/lang', () => { return {} }, { virtual: true })
jest.mock('esri/geometry/geometryEngineAsync', () => { return {} }, { virtual: true })
jest.mock('esri/geometry/Polyline', () => { return {} }, { virtual: true })
jest.mock('esri/geometry/SpatialReference', () => { return {} }, { virtual: true })
jest.mock('esri/core/unitUtils', () => { return {} }, { virtual: true })
jest.mock('esri/Graphic', () => {
  return { default: jest.fn().mockImplementation(() => { return {} }) }
}, { virtual: true })
jest.mock('esri/widgets/Sketch/SketchViewModel', () => { return {} }, { virtual: true })
jest.mock('esri/Color', () => { return {} }, { virtual: true })
jest.mock('esri/layers/GraphicsLayer', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        removeAll: () => (null),
        destroy: () => (null),
        add: () => (null)
      }
    })
  }
}, { virtual: true })
jest.mock('esri/layers/FeatureLayer', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        removeAll: () => (null),
        destroy: () => (null)
      }
    })
  }
}, { virtual: true })
jest.mock('esri/geometry/Point', () => { return {} }, { virtual: true })
jest.mock('esri/geometry/Extent', () => { return {} }, { virtual: true })
jest.mock('esri/rest/support/Query', () => { return {} }, { virtual: true })
jest.mock('esri/rest/query', () => { return {} }, { virtual: true })
jest.mock('esri/geometry/geometryEngine', () => {
  return {
    isSimple: (geom) => { return true },
    simplify: (geom) => { return geom }
  }
}, { virtual: true })
jest.mock('esri/widgets/ElevationProfile/ElevationProfileViewModel', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        destroy: () => (null),
        clear: () => (null)
      }
    })
  }
}, { virtual: true })
jest.mock('esri/core/reactiveUtils', () => { return {} }, { virtual: true })
jest.mock('esri/layers/ElevationLayer', () => { return {} }, { virtual: true })
jest.mock('esri/symbols/support/jsonUtils', () => {
  return {
    fromJSON: (sym) => { return {} }
  }
}, { virtual: true })
jest.mock('esri/geometry/Polyline', () => { return {} }, { virtual: true })
jest.mock('esri/geometry/SpatialReference', () => { return {} }, { virtual: true })
jest.mock('esri/core/promiseUtils', () => { return {} }, { virtual: true })
const commonConfig = {
  useMapWidget: false,
  activeDataSource: 'default',
  generalSettings: {
    allowExport: true,
    isSelectToolActive: false,
    isDrawToolActive: false,
    showGridAxis: true,
    showAxisTitles: false,
    showLegend: true,
    buttonStyle: 'ICONTEXT'
  },
  configInfo: {
    default: {
      profileChartSettings: {
        isCustomElevationLayer: true,
        elevationLayerURL: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
        linearUnit: 'meters',
        elevationUnit: 'kilometers',
        displayStatistics: true,
        selectedStatistics: [],
        groundColor: '#b54900',
        graphicsHighlightColor: '#b54900',
        showVolumetricObjLineInGraph: true,
        volumetricObjLineColor: '#cf4ccf',
        volumetricObjLabel: defaultMessages.volumetricObjectsLabel
      }
    }
  }
}

//Since Surfaces are not available in mock theme we are overriding it
const theme = {
  ...mockTheme,
  surfaces: [{ bg: '#fff' }, { bg: '#fff' }]
} as unknown as IMThemeVariables

describe('Validate availability of Draw and Select tool depending on available data sources and selectable line layers', () => {
  it('If the map is not selected through selector or None is selected then widget placeholder should be shown', function () {
    const { queryByTestId } = render(<Widget theme={theme} config={commonConfig} layouts={{} as any} />)
    expect(queryByTestId('widgetPlaceholder')).toBeInTheDocument()
  })

  it('If the map is selected through a selector and no web map/scene is found in the Map widget then only the Draw tool should be available.', async function () {
    const useMapWidgetId: ImmutableArray<string> = Immutable(['widget_1'])
    const config = {
      ...commonConfig,
      useMapWidget: true,
      activeDataSource: 'default',
      configInfo: {
        default: {
          profileSettings: {
            isProfileSettingsEnabled: false,
            isCustomizeOptionEnabled: false,
            layers: []
          },
          assetSettings: {
            isAssetSettingsEnabled: false,
            layers: [],
            assetIntersectingBuffer: {
              enabled: false,
              bufferDistance: 10,
              bufferUnits: '',
              bufferSymbol: {
                type: 'esriSFS',
                color: [239, 132, 38, 128],
                outline: {
                  type: 'esriSLS',
                  color: [184, 115, 59, 255],
                  width: 1.5,
                  style: 'esriSLSSolid'
                },
                style: 'esriSFSSolid'
              }
            }
          },
          profileChartSettings: {
            linearUnit: 'meters',
            elevationUnit: 'kilometers'
          }
        }
      }
    }
    const ref: { current: HTMLElement } = { current: null }
    const Widget = wrapWidget(ElevationProfileWidget as any, { theme: mockTheme, ref } as any)
    const { queryByTestId, getByTestId } = render(<Widget useMapWidgetIds={useMapWidgetId} theme={theme} config={config} layouts={{} as any} />)
    const jimuMapview = {
      dataSourceId: 'dataSource_1',
      mapWidgetId: 'widget_2',
      maxLayerIndex: 2,
      view: {
        goTo: jest.fn(),
        map: {
          add: jest.fn(),
          layers: { toArray: () => {} },
          findLayerById: jest.fn(),
          ground: { opacity: 1 }
        }
      },
      whenAllJimuLayerViewLoaded: jest.fn(),
      clearSelectedFeatures: jest.fn()
    }
    await (ref.current as any).activeViewChangeHandler(jimuMapview)
    setTimeout(() => {
      expect(queryByTestId('drawButton')).toBeInTheDocument()
      expect(getByTestId('drawButton')).toHaveClass('front-section')
      expect(getByTestId('selectButton')).toHaveClass('hidden')
    }, 500)
  })

  it('Only show draw tool if there are no selectable lines in the map/scene.', async function () {
    const useMapWidgetId: ImmutableArray<string> = Immutable(['widget_1'])
    const config = {
      ...commonConfig,
      useMapWidget: true,
      activeDataSource: 'dataSource_1',
      configInfo: {
        dataSource_1: {
          profileSettings: {
            isProfileSettingsEnabled: false,
            isCustomizeOptionEnabled: false,
            layers: []
          },
          assetSettings: {
            isAssetSettingsEnabled: false,
            layers: [],
            assetIntersectingBuffer: {
              enabled: false,
              bufferDistance: 10,
              bufferUnits: '',
              bufferSymbol: {
                type: 'esriSFS',
                color: [239, 132, 38, 128],
                outline: {
                  type: 'esriSLS',
                  color: [184, 115, 59, 255],
                  width: 1.5,
                  style: 'esriSLSSolid'
                },
                style: 'esriSFSSolid'
              }
            }
          },
          profileChartSettings: {
            linearUnit: 'meters',
            elevationUnit: 'kilometers'
          }
        }
      }
    }
    const jimuMapview = {
      dataSourceId: 'dataSource_1',
      mapWidgetId: 'widget_2',
      maxLayerIndex: 2,
      view: {
        goTo: jest.fn(),
        map: {
          add: jest.fn(),
          layers: { toArray: () => {} },
          findLayerById: jest.fn(),
          ground: { opacity: 1 }
        }
      },
      whenAllJimuLayerViewLoaded: jest.fn(),
      clearSelectedFeatures: jest.fn()
    }
    const ref: { current: HTMLElement } = { current: null }
    const Widget = wrapWidget(ElevationProfileWidget as any, { theme: mockTheme, ref } as any)
    const { getByTestId } = render(<Widget useMapWidgetIds={useMapWidgetId} theme={theme} config={config} layouts={{} as any} />)
    await (ref.current as any).activeViewChangeHandler(jimuMapview)
    setTimeout(() => {
      expect(getByTestId('drawButton')).toHaveClass('front-section')
      expect(getByTestId('selectButton')).toHaveClass('hidden')
    }, 500)
  })
})

describe('Validate output datasource', function () {
  it('Validate output data source is updated, along with units, when units are changed', function () {
    const useMapWidgetId: ImmutableArray<string> = Immutable(['widget_1'])
    const config = {
      useMapWidget: true,
      activeDataSource: 'default',
      configInfo: {
        default: {
          profileChartSettings: {
            linearUnit: 'meters',
            elevationUnit: 'kilometers'
          }
        }
      }
    }
    const mockProfileResult = {
      effectiveUnits: {
        distance: 'feet',
        elevation: 'feet'
      },
      samples: [
        {
          x: 8149294.3746740585,
          y: 2159631.6006988604,
          z: 56.28325969864362,
          distance: 0,
          elevation: 184.65636384069427
        },
        {
          x: 8149295.145197668,
          y: 2159634.0222936743,
          z: 56.43088908244661,
          distance: 7.8412073490813645,
          elevation: 185.14071221275134
        },
        {
          x: 8149295.915723635,
          y: 2159636.443895543,
          z: 56.55265548218044,
          distance: 15.682414698162729,
          elevation: 185.5402082748702
        },
        {
          x: 8149296.686248707,
          y: 2159638.8654942806,
          z: 56.67016321151199,
          distance: 23.523622047244093,
          elevation: 185.92573232123357
        },
        {
          x: 8149297.45677397,
          y: 2159641.2870932813,
          z: 56.78767095587395,
          distance: 31.364829396325458,
          elevation: 186.31125641690926
        },
        {
          x: 8149298.227299423,
          y: 2159643.708692546,
          z: 56.90517871524675,
          distance: 39.20603674540683,
          elevation: 186.69678056183315
        },
        {
          x: 8149298.759701471,
          y: 2159645.381919892,
          z: 56.98637183516004,
          distance: 44.62399383527127,
          elevation: 186.96316218884527
        }
      ],
      progress: 1,
      chartFillEnabled: true,
      chartStrokeWidth: 1.5,
      chartStrokeOffsetY: 0,
      viewVisualizationEnabled: true,
      statistics: {
        maxDistance: 44.62399383527127,
        minElevation: 184.65636384069427,
        maxElevation: 186.96316218884527,
        avgElevation: 185.890602259591,
        elevationGain: 2.306798348150997,
        elevationLoss: 0,
        maxPositiveSlope: 2.295458596162128,
        maxNegativeSlope: null,
        avgPositiveSlope: 2.295458596162128,
        avgNegativeSlope: null
      }
    }
    const ref: { current: HTMLElement } = { current: null }
    const Widget = wrapWidget(ElevationProfileWidget as any, { theme: mockTheme, ref } as any)
    render(<Widget useMapWidgetIds={useMapWidgetId} theme={theme} config={config} layouts={{} as any} />)

    const statsValuesMetersKms = [
      { statName: 'maxDistance', statValue: '13.6 m' },
      { statName: 'minElevation', statValue: '0.06 km' },
      { statName: 'maxElevation', statValue: '0.06 km' },
      { statName: 'avgElevation', statValue: '0.06 km' },
      { statName: 'elevationGain', statValue: '0 km' },
      { statName: 'elevationLoss', statValue: '0 km' },
      { statName: 'maxPositiveSlope', statValue: '2.3 °' },
      { statName: 'maxNegativeSlope', statValue: 'No value' },
      { statName: 'avgPositiveSlope', statValue: '2.3 °' },
      { statName: 'avgNegativeSlope', statValue: 'No value' }]
    const statsResultMetersKms = (ref.current as any).outputStatisticsValueDisplay(mockProfileResult,
      config.configInfo.default.profileChartSettings.elevationUnit, config.configInfo.default.profileChartSettings.linearUnit, false)
    expect(statsResultMetersKms).not.toBe(statsValuesMetersKms)

    const statsValuesMilesKms = [
      { statName: 'maxDistance', statValue: '0.01 mi' },
      { statName: 'minElevation', statValue: '0.06 km' },
      { statName: 'maxElevation', statValue: '0.06 km' },
      { statName: 'avgElevation', statValue: '0.06 km' },
      { statName: 'elevationGain', statValue: '0 km' },
      { statName: 'elevationLoss', statValue: '0 km' },
      { statName: 'maxPositiveSlope', statValue: '2.3 °' },
      { statName: 'maxNegativeSlope', statValue: 'No value' },
      { statName: 'avgPositiveSlope', statValue: '2.3 °' },
      { statName: 'avgNegativeSlope', statValue: 'No value' }]
    const statsResultMilesKms = (ref.current as any).outputStatisticsValueDisplay(mockProfileResult,
      'kilometers', 'miles', false)
    expect(statsResultMilesKms).not.toBe(statsValuesMilesKms)
  })
})

describe('Validate buffer', function () {
  it('When buffer is enabled, valid buffer is generated', async function () {
    const useMapWidgetId: ImmutableArray<string> = Immutable(['widget_1'])
    const config = {
      useMapWidget: true,
      activeDataSource: 'default',
      configInfo: {
        default: {
          profileChartSettings: {
            linearUnit: 'meters',
            elevationUnit: 'kilometers'
          }
        }
      }
    }
    const ref: { current: HTMLElement } = { current: null }
    const Widget = wrapWidget(ElevationProfileWidget as any, { theme: mockTheme, ref } as any)
    render(<Widget useMapWidgetIds={useMapWidgetId} theme={theme} config={config} layouts={{} as any} />)
    const mockElevationProfileViewModel = {
      input: {
        geometry: {
          type: 'polyline',
          paths: [
            [[8155703.266454776, 2159222.1716818446], [8156030.25691993, 2159355.037278883]]
          ],
          spatialReference: {
            latestWkid: 3857,
            wkid: 102100,
            isGeographic: false,
            isWGS84: false,
            isWebMercator: true
          }
        }
      },
      clear: jest.fn()
    }
    ; (ref.current as any).selectedBufferValues = {
      enabled: true,
      bufferDistance: 10,
      bufferUnits: 'feet'
    }
    ; (ref.current as any)._defaultViewModel = mockElevationProfileViewModel
    await (ref.current as any).createBufferGraphics()
    expect((ref.current as any).bufferGraphics).not.toBe(null)
  })

  it('When buffer is disabled, buffer is not generated', async function () {
    const useMapWidgetId: ImmutableArray<string> = Immutable(['widget_1'])
    const config = {
      useMapWidget: true,
      activeDataSource: 'default',
      configInfo: {
        default: {
          profileChartSettings: {
            linearUnit: 'meters',
            elevationUnit: 'kilometers'
          }
        }
      }
    }
    const ref: { current: HTMLElement } = { current: null }
    const Widget = wrapWidget(ElevationProfileWidget as any, { theme: mockTheme, ref } as any)
    render(<Widget useMapWidgetIds={useMapWidgetId} theme={theme} config={config} layouts={{} as any} />)
    const mockElevationProfileViewModel = {
      input: {
        geometry: {}
      },
      clear: jest.fn()
    }
    ; (ref.current as any).selectedBufferValues = {
      enabled: false,
      bufferDistance: -1,
      bufferUnits: 'feet'
    }
    ; (ref.current as any)._defaultViewModel = mockElevationProfileViewModel
    await (ref.current as any).createBufferGraphics()
    expect((ref.current as any).bufferGraphics).toBe(null)
  })
})

describe('Validate for volumetric objects', function () {
  it('Validate Volumetric Objects are read when enabled', async function () {
    const useMapWidgetId: ImmutableArray<string> = Immutable(['widget_1'])
    const config = {
      useMapWidget: true,
      activeDataSource: 'ds2',
      configInfo: {
        ds2: {
          profileChartSettings: {
            showVolumetricObjLineInGraph: true,
            volumetricObjLineColor: '#cf4ccf',
            volumetricObjLabel: defaultMessages.volumetricObjectsLabel
          }
        }
      }
    }
    const ref: { current: HTMLElement } = { current: null }
    const Widget = wrapWidget(ElevationProfileWidget as any, { theme: mockTheme, ref } as any)
    render(<Widget useMapWidgetIds={useMapWidgetId} theme={theme} config={config} layouts={{} as any} />)
    const mockViewProfiles = {
      type: 'view', // view line Profile
      color: config.configInfo.ds2.profileChartSettings.volumetricObjLineColor
    }
    const updateViewProfile = (ref.current as any).checkForVolumetricObjects('3d')
    expect(updateViewProfile).toStrictEqual(mockViewProfiles)
  })

  it('Validate no visible profiles for volumetric objects when it is disabled', async function () {
    const useMapWidgetId: ImmutableArray<string> = Immutable(['widget_1'])
    const config = {
      useMapWidget: true,
      activeDataSource: 'ds2',
      configInfo: {
        ds2: {
          profileChartSettings: {
            showVolumetricObjLineInGraph: false,
            volumetricObjLineColor: '#cf4ccf',
            volumetricObjLabel: defaultMessages.volumetricObjectsLabel
          }
        }
      }
    }
    const ref: { current: HTMLElement } = { current: null }
    const Widget = wrapWidget(ElevationProfileWidget as any, { theme: mockTheme, ref } as any)
    render(<Widget useMapWidgetIds={useMapWidgetId} theme={theme} config={config} layouts={{} as any} />)
    const updateViewProfile = (ref.current as any).checkForVolumetricObjects('3d')
    expect(updateViewProfile).toBe(null)
  })
})
