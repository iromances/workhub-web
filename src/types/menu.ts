export interface MenuItem {
  key: string
  label: string
  path: string
  permission?: string
  children?: MenuItem[]
}
