param staticSites_fanwave_name string = 'fanwave'

resource staticSites_fanwave_name_resource 'Microsoft.Web/staticSites@2024-11-01' = {
  name: staticSites_fanwave_name
  location: 'East US 2'
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: 'https://github.com/gogorichie/wave'
    branch: 'main'
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: 'GitHub'
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

resource staticSites_fanwave_name_default 'Microsoft.Web/staticSites/basicAuth@2024-11-01' = {
  parent: staticSites_fanwave_name_resource
  name: 'default'
  location: 'East US 2'
  properties: {
    applicableEnvironmentsMode: 'SpecifiedEnvironments'
  }
}
