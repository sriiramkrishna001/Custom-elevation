import { type WidgetUpgradeInfo, WidgetVersionManager } from 'jimu-core'
import { getUseDataSourcesForAllDs } from './common/utils'

class VersionManager extends WidgetVersionManager {
  versions = [{
    version: '1.15.0',
    description: 'Upgrade output data source json and use data sources',
    upgradeFullInfo: true,
    upgrader: (oldInfo: WidgetUpgradeInfo) => {
      const oldOutputDsJson = oldInfo.outputDataSourceJsons
      //update the old config use data sources
      const configInfo = oldInfo.widgetJson.config.configInfo
      const widgetJson = oldInfo.widgetJson.set('useDataSources', getUseDataSourcesForAllDs(configInfo))
      const updatedInfo = { ...oldInfo, widgetJson }
      let outputInfo = updatedInfo
      //update the geometry for output data source
      updatedInfo.widgetJson.outputDataSources?.forEach((outputDsId: string) => {
        let dsJson = oldOutputDsJson[outputDsId]
        dsJson = dsJson.set('geometryType', 'esriGeometryPolyline')
        const outputDataSourceJsons = oldOutputDsJson.set(outputDsId, dsJson)
        outputInfo = { ...updatedInfo, outputDataSourceJsons }
      })
      return outputInfo
    }
  }]
}

export const versionManager = new VersionManager()
