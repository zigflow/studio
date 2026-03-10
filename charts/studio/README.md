# studio

![Version: 0.0.0](https://img.shields.io/badge/Version-0.0.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square)

Web UI for visualising and editing Zigflow workflows

**Homepage:** <https://zigflow.dev>

## Maintainers

| Name | Email | Url |
| ---- | ------ | --- |
| Simon Emms | <simon@simonemms.com> | <https://simonemms.com> |

## Source Code

* <https://github.com/zigflow/studio>

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| affinity | object | `{}` | Node affinity |
| autoscaling.enabled | bool | `false` | Autoscaling enabled |
| autoscaling.maxReplicas | int | `100` | Maximum replicas |
| autoscaling.minReplicas | int | `1` | Minimum replicas |
| autoscaling.targetCPUUtilizationPercentage | int | `80` | When to trigger a new replica |
| dataDir | string | `"/data"` | Path on the container where workflow YAML files are read from |
| envvars | list | `[]` | Additional environment variables |
| fullnameOverride | string | `""` | String to fully override names |
| image.pullPolicy | string | `"IfNotPresent"` | Image pull policy |
| image.repository | string | `"ghcr.io/zigflow/studio"` | Image repository |
| image.tag | string | `""` | Image tag - defaults to the chart's <code>Version</code> if not set |
| imagePullSecrets | list | `[]` | Docker registry secret names |
| livenessProbe.httpGet.path | string | `"/"` | Path to demonstrate app liveness |
| livenessProbe.httpGet.port | string | `"http"` | Port to demonstrate app liveness |
| nameOverride | string | `""` | String to partially override name |
| nodeSelector | object | `{}` | Node selector |
| podAnnotations | object | `{}` | Pod <a href="https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations" target="_blank">annotations</a> |
| podLabels | object | `{}` | Pod <a href="https://kubernetes.io/docs/concepts/overview/working-with-objects/labels" target="_blank">labels</a> |
| podSecurityContext | object | `{"fsGroup":1000,"runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}}` | Pod's <a href="https://kubernetes.io/docs/tasks/configure-pod-container/security-context" target="_blank">security context</a> |
| readinessProbe.httpGet.path | string | `"/"` | Path to demonstrate app readiness |
| readinessProbe.httpGet.port | string | `"http"` | Port to demonstrate app readiness |
| replicaCount | int | `1` | Number of replicas |
| resources | object | `{}` | Configure resources available |
| securityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true,"runAsNonRoot":true,"seccompProfile":{"type":"RuntimeDefault"}}` | Container's security context |
| service.port | int | `3000` | Service port |
| service.type | string | `"ClusterIP"` | Service type |
| serviceAccount.annotations | object | `{}` | Annotations to add to the service account |
| serviceAccount.automount | bool | `true` | Automatically mount a ServiceAccount's API credentials? |
| serviceAccount.create | bool | `true` | Specifies whether a service account should be created |
| serviceAccount.name | string | `""` | The name of the service account to use. If not set and create is true, a name is generated using the fullname template |
| tolerations | list | `[]` | Node toleration |
| volumeMounts | list | `[]` | Additional volumeMounts on the output Deployment definition. |
| volumes | list | `[]` | Additional volumes on the output Deployment definition. |

