let response = {
  get body () {
    return this._body // get时返回出去
  },
  set body (value) {
    this.res.statusCode = 200 // 只有设置了body, 就应该吧状态吗设置为200
    this._body = value // set时先保存下来
  }
}

module.exports = response