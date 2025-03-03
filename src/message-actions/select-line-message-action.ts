import {
  AbstractMessageAction, type DataRecordsSelectionChangeMessage, DataSourceManager,
  getAppStore, Immutable, type ImmutableArray, type MessageDescription, MessageType, MutableStoreManager, type UseDataSource
} from 'jimu-core'

export default class SelectLineMessageAction extends AbstractMessageAction {
  filterMessageDescription (messageDescription: MessageDescription): boolean {
    if (messageDescription.messageType === MessageType.DataRecordsSelectionChange) {
      const dataSourceManager = DataSourceManager.getInstance()
      const messageWidgetUseDataSources = getDsByWidgetId(messageDescription.widgetId, messageDescription.messageType)
      return messageWidgetUseDataSources?.some(useDataSource => {
        const ds: any = dataSourceManager.getDataSource(useDataSource.dataSourceId)
        //check ds for map widget (webmap or webscene) or for other widgets like table, list for the configured layer (line layer)
        if (ds && (ds.type === 'WEB_MAP' || ds.type === 'WEB_SCENE' || (ds.type === 'FEATURE_LAYER' && ds.getGeometryType() === 'esriGeometryPolyline'))) {
          return true
        } else {
          return false
        }
      })
    }
  }

  filterMessageType (messageType: MessageType): boolean {
    return messageType === MessageType.DataRecordsSelectionChange
  }

  filterMessage (message: any): boolean {
    //only if the selected feature is of type polyline execute the action else filter the out the msg
    if (message?.records?.length > 0) {
      const polylineRecords = message?.records.filter((record) => record?.feature?.geometry?.type === 'polyline')
      return polylineRecords.length > 0
    }
    return false
  }

  //on selection of the features in map widget get the data record set by execute method
  onExecute (message: DataRecordsSelectionChangeMessage): boolean {
    const dataRecordsSelectionChangeMessage = message
    //get the map selected features records
    MutableStoreManager.getInstance().updateStateValue(this.widgetId, 'selectedFeatureRecords', dataRecordsSelectionChangeMessage.records)
    return true
  }

  getSettingComponentUri (messageType: MessageType, messageWidgetId?: string): string {
    return null
  }
}

//get datasource using other widget id (list, table)
export function getDsByWidgetId (wId: string, messageType: MessageType): ImmutableArray<UseDataSource> {
  const appConfig = getAppConfig()
  const widgetJson = appConfig?.widgets?.[wId]
  const useDataSources = widgetJson?.useDataSources || Immutable([])
  return useDataSources
}

function getAppConfig () {
  return window.jimuConfig.isBuilder ? getAppStore().getState()?.appStateInBuilder?.appConfig : getAppStore().getState()?.appConfig
}
