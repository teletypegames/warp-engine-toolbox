const vscode = acquireVsCodeApi()
const config = JSON.parse(document.getElementById('warpengine-config').textContent)
const texts = config.texts
const props = config.schema.properties || {}
const order = ['name', 'title', 'version', 'author', 'desc', 'license', 'category', 'site', 'repo', 'directory_name', 'shelf_name']
const form = document.getElementById('form')
const errorLine = document.getElementById('error')
let data = {}

function option(select, value, text) {
  const item = document.createElement('option')
  item.value = value
  item.textContent = text
  select.appendChild(item)
}

function label(id, path, spec) {
  const element = document.createElement('label')
  element.htmlFor = id
  element.textContent = path[path.length - 1]
  if (spec.description) {
    const hint = document.createElement('span')
    hint.className = 'hint'
    hint.textContent = spec.description
    element.appendChild(hint)
  }
  return element
}

function booleanField(value) {
  const element = document.createElement('select')
  for (const [text, val] of [[texts.notSet, ''], ['true', 'true'], ['false', 'false']]) option(element, val, text)
  element.value = value === undefined ? '' : String(value)
  return element
}

function enumField(spec, value) {
  const element = document.createElement('select')
  for (const val of ['', ...spec.enum]) option(element, val, val || texts.byDefault)
  element.value = value ?? ''
  return element
}

function textArea(value) {
  const element = document.createElement('textarea')
  element.value = value ?? ''
  return element
}

function textField(id, spec, value, wrap) {
  const element = document.createElement('input')
  element.type = 'text'
  element.value = value ?? ''
  if (Array.isArray(spec.examples) && spec.examples.length) {
    const list = document.createElement('datalist')
    list.id = id + '-list'
    for (const example of spec.examples) option(list, example, example)
    wrap.appendChild(list)
    element.setAttribute('list', list.id)
  }
  if (spec.maxLength) element.maxLength = spec.maxLength
  return element
}

function field(id, path, spec, value, wrap) {
  if (spec.type === 'boolean') return booleanField(value)
  if (Array.isArray(spec.enum)) return enumField(spec, value)
  if (spec.type === 'object') return textArea(value === undefined ? '' : JSON.stringify(value, null, 2))
  if (path[path.length - 1] === 'desc') return textArea(value)
  return textField(id, spec, value, wrap)
}

function parsed(id, spec, raw) {
  if (spec.type === 'boolean') return { value: raw === '' ? null : raw === 'true' }
  if (spec.type !== 'object') return { value: raw }
  if (raw.trim() === '') return { value: null }
  try {
    const value = JSON.parse(raw)
    errorLine.textContent = ''
    return { value }
  } catch (error) {
    errorLine.textContent = id + ': ' + texts.notJson
    return null
  }
}

function input(path, spec, value) {
  const id = path.join('.')
  const wrap = document.createElement('div')
  wrap.appendChild(label(id, path, spec))
  const element = field(id, path, spec, value, wrap)
  element.id = id
  element.addEventListener('change', () => {
    const result = parsed(id, spec, element.value)
    if (result) vscode.postMessage({ type: 'set', path, value: result.value })
  })
  wrap.appendChild(element)
  return wrap
}

function webFieldset() {
  const set = document.createElement('fieldset')
  const legend = document.createElement('legend')
  legend.textContent = texts.webPlay
  set.appendChild(legend)
  for (const [key, spec] of Object.entries(props.web.properties)) set.appendChild(input(['web', key], spec, (data.web || {})[key]))
  return set
}

function render() {
  form.textContent = ''
  const keys = [...order.filter((key) => props[key]), ...Object.keys(props).filter((key) => !order.includes(key) && key !== 'web')]
  for (const key of keys) form.appendChild(input([key], props[key], data[key]))
  if (props.web && props.web.properties) form.appendChild(webFieldset())
}

window.addEventListener('message', (event) => {
  if (event.data.type !== 'document') return
  try {
    data = JSON.parse(event.data.text || '{}')
    errorLine.textContent = ''
    if (!form.contains(document.activeElement)) render()
  } catch (error) {
    errorLine.textContent = texts.invalidJson
  }
})
document.getElementById('source').onclick = () => vscode.postMessage({ type: 'source' })
vscode.postMessage({ type: 'ready' })
