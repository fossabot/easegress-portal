import { isNullOrUndefined } from "@/common/utils"
import api from "./api"
import { ClusterType, getClientInfo } from "./cluster"
import { urls } from "./urls"
import { AxiosResponse } from "axios"
import yaml from "js-yaml"
import _ from "lodash"

export type Object = {
  name: string
  kind: string
}

export namespace pipeline {
  export type Pipeline = Object & {
    flow: FlowNode[]
    filters: Filter[]
    resilience: Resilience[]
  }

  export type Filter = Object & {
    [key: string]: any
  }

  export type FlowNode = {
    filter: string
    alias: string
    namespace: string
    jumpIf: {
      [key: string]: string
    }
  }

  export type Resilience = Object & {
    [key: string]: any
  }
}

export namespace httpserver {
  export type HTTPServer = Object & {
    rules: Rule[]
    port: number
    // add others when necessary
    // [key: string]: any
  }

  export type Rule = {
    host: string | undefined
    hostRegexp: string | undefined
    hosts: Host[] | undefined
    paths: Path[] | undefined
    ipFilter: IPFilter | undefined
  }

  export type Host = {
    isRegexp: boolean | undefined
    value: string
  }

  export type Path = {
    ipFilter: IPFilter
    path: string | undefined
    pathPrefix: string | undefined
    pathRegexp: string | undefined
    rewriteTarget: string | undefined
    methods: string[] | undefined
    backend: string
    clientMaxBodySize: number | undefined
    headers: Header[] | undefined
    queries: Query[] | undefined
    matchAllHeader: boolean | undefined
    matchAllQuery: boolean | undefined
  }

  export type IPFilter = {
    blockByDefault: boolean | undefined
    allowIPs: string[] | undefined
    blockIPs: string[] | undefined
  }

  export function isIPFilterEmpty(ipFilter: IPFilter | undefined): boolean {
    if (isNullOrUndefined(ipFilter)) {
      return true
    }
    if (!isNullOrUndefined(ipFilter!.allowIPs) && ipFilter!.allowIPs!.length > 0) {
      return false
    }
    if (!isNullOrUndefined(ipFilter!.blockIPs) && ipFilter!.blockIPs!.length > 0) {
      return false
    }
    return true
  }

  export type Header = {
    key: string
    values: string[] | undefined
    regexp: string | undefined
  }

  export function isHeadersEmpty(headers: Header[] | undefined): boolean {
    if (isNullOrUndefined(headers) || headers!.length === 0) {
      return true
    }
    return false
  }

  export type Query = Header
}

// define a type that split obejcts into different kinds
export type Objects = {
  pipelines: pipeline.Pipeline[]
  httpServers: httpserver.HTTPServer[]
  others: Object[]
}

export async function getObjects(cluster: ClusterType) {
  const info = getClientInfo(cluster, urls.Objects)
  return await api.get<any, AxiosResponse<Object[]>>(info.url, info.config).then(res => res.data).then(data => {
    const result: Objects = {
      pipelines: [],
      httpServers: [],
      others: []
    }

    data.forEach((obj: Object) => {
      if (obj.kind === "Pipeline") {
        result.pipelines.push(obj as pipeline.Pipeline)
      } else if (obj.kind === "HTTPServer") {
        result.httpServers.push(obj as httpserver.HTTPServer)
      } else {
        result.others.push(obj)
      }
    })
    return result
  })
}

function yamlToJson(yamlStr: string) {
  return JSON.stringify(yaml.load(yamlStr))
}

export async function createObject(cluster: ClusterType, objectYaml: string) {
  const info = getClientInfo(cluster, urls.Objects)
  const json = yamlToJson(objectYaml)
  return await api.post(info.url, json, info.config)
}

export async function updateObject(cluster: ClusterType, obj: Object, objectYaml: string) {
  const info = getClientInfo(cluster, urls.ObjectItem(obj.name))
  const json = yamlToJson(objectYaml)
  return await api.put(info.url, json, info.config)
}

export async function deleteObject(cluster: ClusterType, objectName: string) {
  const info = getClientInfo(cluster, urls.ObjectItem(objectName))
  return await api.delete(info.url, info.config)
}

// Status is status of objects. Key is node name. Value is status.
// Easegress api of status returns a map of node name to {spec, status}.
export type Status = {
  [key: string]: {
    status: any
  }
}

export async function getObjectStatus(cluster: ClusterType, objectName: string) {
  const info = getClientInfo(cluster, urls.StatusObjectItemURL(objectName))
  return await api.get(info.url, info.config).then(res => res.data).then(data => {
    const status = data as {
      [key: string]: {
        spec: any
        status: any
      }
    }
    const result: Status = {}
    _.map(status, (value, key) => {
      const parts = key.split("/")
      parts.shift()
      if (parts.length < 1 || parts[0] !== objectName) {
        return
      }
      const nodeName = parts.join("/")
      result[nodeName || key] = value.status
    })
    return result
  })
}