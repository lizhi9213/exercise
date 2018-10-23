let http = require('http')
let EventEmitter = require('events')
let context = require('./context')
let request = require('./request')
let response = require('./response')
let Stream = require('stream')

class Koa extends EventEmitter {
  constructor() {
    super()
    // this.fn // 改成：
    this.middlewares = [] // 需要一个数组将每个中间件按顺序存放起来
    this.context = context // 将三个模块保存，全局的防到实例上
    this.request = request
    this.response = response
  }
  use(fn) {
    // this.fn = fn // 用户使用use方法时，回调赋给fn ，改成：
    this.middlewares.push(fn)
  }
  compose(middlewares, ctx) {
    // 简化版compose， 接收中间件数组，ctx对象作为参数
    function dispatch(index) {
      // 利用递归函数将各中间件串联起来依次调用
      if (index === middlewares.length) return // 最后依次next不能执行，不然会报错
      let middleware = middlewares[index] // 取当前应该被调用的函数
      return Promise.resolve(middleware(ctx, () => dispatch(index + 1))) // 调用并传入ctx和下一个将被调用的函数，用户next()时执行该函数
    }
    return dispatch(0)
  }
  createContext(req, res) {
    // 这是核心，创建ctx
    // 使用object.create方法是为了继承this.context但在增加属性时不影响原对象
    const ctx = Object.create(this.context)
    const request = ctx.request = Object.create(this.request)
    const response = ctx.response = Object.create(this.response)
    // 请仔细阅读以下眼花缭乱的操作，后面是有用的
    ctx.req = request.req = response.req = req
    ctx.res = request.res = response.res = res
    request.ctx = response.ctx = ctx
    request.response = response
    response.request = request
    return ctx
  }
  handleRequest(req, res) {
    // 创建一个处理请求的函数
    res.statusCode = 404 // 默认404
    let ctx = this.createContext(req, res) // 创建ctx
    // this.fn(ctx) // 调用用户给的回调，把ctx还给用户使用 改成：
    let fn = this.compose(this.middlewares, ctx) // 调用compose, 传入参数
    fn.then(() => {
      // then了之后再进行判断
      if (typeof ctx.body == 'object') {
        // 如果是个对象，按json形式输出
        res.setHeader('Content-Type', 'application/json;charset=utf8')
        res.end(JSON.stringify(ctx.body))
      } else if (ctx.body instanceof Stream) {
        // 如果是流
        ctx.body.pipe(res)
      } else if (typeof ctx.body === 'string' || Buffer.isBuffer(ctx.body)) {
        //如果是字符串或者buffer\
        res.setHeader('Content-Type', 'text/htmlcharset=utf8')
        res.end(ctx.body)
      } else {
        res.end('Not found')
      }
    }).catch(err => {
      this.emit('error', err)
      res.statusCode = 500
      res.end('server error')
    })
  }
  listen(...args) {
    let server = http.createServer(this.handleRequest.bind(this)) // 这里使用bind调用，防止this丢失
    server.listen(...args) // 因为listen方法可能有多参数，所以这里直接解构所有的参数就可以了
  }
}

module.exports = Koa