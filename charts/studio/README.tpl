{*
 Copyright 2025 - 2026 Zigflow authors <https://github.com/zigflow/studio/graphs/contributors>

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*}

# Zigflow Studio

{{ template "chart.deprecationWarning" . }}

[![Version](https://img.shields.io/github/v/release/zigflow/studio?label=Version&color=007ec6)](https://github.com/zigflow/studio/tree/main/charts/studio)
![Type: Application](https://img.shields.io/badge/Type-Application-informational)

{{ template "chart.description" . }}

{{ template "chart.homepageLine" . }}

## TL;DR

Be sure to set `${ZIGFLOW_VERSION}` with [your desired version](https://github.com/zigflow/studio/pkgs/container/charts%2Fstudio)

```sh
helm install myrelease oci://ghcr.io/mrsimonemms/charts/studio@${ZIGFLOW_VERSION}
```

{{ template "chart.maintainersSection" . }}

{{ template "chart.sourcesSection" . }}

{{ template "chart.requirementsSection" . }}

{{ template "chart.valuesSectionHtml" . }}

{{ template "helm-docs.versionFooter" . }}
