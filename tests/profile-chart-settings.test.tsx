import * as React from 'react'
import { mockTheme, widgetRender, wrapWidget } from 'jimu-for-test'
import { createIntl } from 'jimu-core'
import ProfileChartSettings from '../src/setting/components/profile-chart-settings'
import { waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
let render = null
beforeAll(() => {
  render = widgetRender(true, mockTheme as any)
})
afterAll(() => {
  render = null
})

const validElevationServices = ['https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer']

// Mock Esri request response for valid & invalid Elevation service
jest.mock('jimu-arcgis', () => {
  return {
    loadArcGISJSAPIModules: async () => {
      return await Promise.resolve([
        function (urlValue) {
          if (validElevationServices.includes(urlValue)) {
            return Promise.resolve({
              data: {
                cacheType: 'Elevation'
              }
            })
          } else {
            return Promise.reject({
              error: {}
            })
          }
        }
      ])
    }
  }
})

describe('Validate that the widget properly checks the elevation layer', function () {
  //Create required config for ProfileChartSettings
  const mockProfileChartConfig = {
    isCustomElevationLayer: true,
    elevationLayerURL: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
    linearUnit: 'miles',
    elevationUnit: 'feet',
    displayStatistics: true,
    selectedStatistics: [],
    groundColor: '#b54900',
    graphicsHighlightColor: '00ffff',
    showVolumetricObjLineInGraph: false,
    volumetricObjLineColor: '#cf4ccf',
    volumetricObjLabel: 'Volumetric objects'
  }
  const props = {
    theme: mockTheme,
    intl: createIntl({ locale: 'en' }),
    isRTL: false,
    config: mockProfileChartConfig,
    currentDs: 'default',
    onProfileChartSettingsUpdated: jest.fn(),
    groundLayerInfo: [],
    portalSelf: { units: 'english' } as __esri.Portal
  }

  it('Should have specified elevation layer URL', async function () {
    const ref: { current: HTMLElement } = { current: null }
    const WidgetSettings = wrapWidget(ProfileChartSettings as any, { theme: mockTheme, ref } as any)
    render(<WidgetSettings widgetId='profileChartSettings' {...props} />)
    await (ref.current as any).loadAPIModule()
    expect((ref.current as any).state.updateElevationLayerURL).toEqual(mockProfileChartConfig.elevationLayerURL)
  })

  it('Valid elevation service URL should be accessible and should not show an error message', async function () {
    const ref: { current: HTMLElement } = { current: null }
    const WidgetSettings = wrapWidget(ProfileChartSettings as any, { theme: mockTheme, ref } as any)
    render(<WidgetSettings widgetId='profileChartSettings' {...props} />)
    await waitFor(() => {
      (ref.current as any).onInputChange(mockProfileChartConfig.elevationLayerURL)
      expect((ref.current as any).state.isInvalidValue).toEqual(false)
    }, { timeout: 100 })
  })

  it('Invalid rest end point of an elevation service URL should show an error message', async function () {
    const ref: { current: HTMLElement } = { current: null }
    const WidgetSettings = wrapWidget(ProfileChartSettings as any, { theme: mockTheme, ref } as any)
    render(<WidgetSettings widgetId='profileChartSettings' {...props} />)

    //Invalid Rest end
    const elevationLayerURL = 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/InvalidRestEND'
    await waitFor(() => {
      (ref.current as any).onInputChange(elevationLayerURL)
      expect((ref.current as any).state.isInvalidValue).toEqual(true)
    }, { timeout: 100 })
  })

  it('Invalid value in elevation service URL textbox should show an error message', async function () {
    const ref: { current: HTMLElement } = { current: null }
    const WidgetSettings = wrapWidget(ProfileChartSettings as any, { theme: mockTheme, ref } as any)
    render(<WidgetSettings widgetId='profileChartSettings' {...props} />)
    //Invalid url
    const elevationLayerURL = 'InvalidURL'
    await waitFor(() => {
      (ref.current as any).onInputChange(elevationLayerURL)
      expect((ref.current as any).state.isInvalidValue).toEqual(true)
    }, { timeout: 100 })
  })

  it('Use Ground Elevation Radio should be disabled when using ground elevation URL is not available', async function () {
    const ref: { current: HTMLElement } = { current: null }
    const WidgetSettings = wrapWidget(ProfileChartSettings as any, { theme: mockTheme, ref } as any)
    const { getByTestId } = render(<WidgetSettings widgetId='profileChartSettings' {...props} />)
    //Use ground elevation layer option should be disabled
    expect((ref.current as any).state.isGroundDisabled).toEqual(true)
    //Use ground elevation layer option should be disabled and unchecked and Custom Elevation option should be checked
    expect(getByTestId('ground')).toBeDisabled()
    expect(getByTestId('ground')).not.toBeChecked()
    expect(getByTestId('custom')).toBeChecked()
  })

  it('Should use ground elevation URL if available', async function () {
    const mockConfigToUseGroundElevationURL = {
      isCustomElevationLayer: false,
      elevationLayerURL: '',
      linearUnit: 'miles',
      elevationUnit: 'feet',
      displayStatistics: true,
      selectedStatistics: [],
      groundColor: '#b54900',
      graphicsHighlightColor: '00ffff',
      showVolumetricObjLineInGraph: false,
      volumetricObjLineColor: '#cf4ccf',
      volumetricObjLabel: 'Volumetric objects'
    }
    const props = {
      theme: mockTheme,
      intl: createIntl({ locale: 'en' }),
      isRTL: false,
      config: mockConfigToUseGroundElevationURL,
      currentDs: 'dataSource_1',
      onProfileChartSettingsUpdated: jest.fn(),
      groundLayerInfo: [{
        dataSourceId: 'dataSource_1',
        isGroundElevationLayerExists: true,
        groundElevationLayerUrl: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer'
      }],
      portalSelf: { units: 'english' } as __esri.Portal
    }
    const ref: { current: HTMLElement } = { current: null }
    const WidgetSettings = wrapWidget(ProfileChartSettings as any, { theme: mockTheme, ref } as any)
    const { getByTestId } = render(<WidgetSettings widgetId='profileChartSettings' {...props} />)
    await (ref.current as any).loadAPIModule()
    //Use ground elevation layer option should be enabled
    expect((ref.current as any).state.isGroundDisabled).toEqual(false)
    //Use ground elevation layer option should be checked and Custom Elevation option should be unchecked
    expect(getByTestId('ground')).toBeChecked()
    expect(getByTestId('custom')).not.toBeChecked()
  })
})
