/*
Dler Cloud 签到脚本

说明：登录 https://dleris.best/ 获取 cookie，cookie有效期为 31 天，失效后需重新获取

QX 1.0.5+ :
[rewrite_local]
^https:\/\/dleris\.best\/user url script-request-header dlercloud.js

[task_local]
0/60 * * * * dlercloud.js

[mitm]
hostname = dleris.best


Surge 4.0 :
[Script]
http-request ^https:\/\/dleris\.best\/user script-path=dlercloud.js
cron "0/60 * * * *" script-path=dlercloud.js

[MITM]
hostname = dleris.best
*/

const $util = init()
const cookieName = 'DlerColoud'
const totalKey = 'DlearCloudTotal'
const url = 'https://dleris.best'

const checkinResult = {
  msg: undefined,
  used: undefined,
  rest: undefined,
  total: undefined,
}

if ($util.isRequest) {
  getCookie()
} else {
  ;(async () => {
    let cookie = $util.read(cookieName)
    await checkin(cookie)
    await getDataTraffic(cookie)
  })().then(() => {
    let msg = `已用流量：${checkinResult.used}\n剩余流量：${checkinResult.rest}\n累计收益：${checkinResult.total}MB`
    $util.notify('Dler Cloud', checkinResult.msg, msg)
  })
}
$util.done()

function getCookie() {
  if ($request.headers) {
    let cookieValue = $request.headers['Cookie']
    if ($util.read(cookieName) != (undefined || null)) {
      if ($util.read(cookieName) != cookieValue) {
        if (!$util.write(cookieValue, cookieName)) {
          $util.notify(`更新 ${cookieName} Cookie 失败‼️`, '', '')
        } else {
          $util.notify(`更新 ${cookieName} Cookie 成功 🎉`, '', '')
        }
      }
    } else {
      if (!$util.write(cookieValue, cookieName)) {
        $util.notify(`首次写入 ${cookieName} Cookie 失败‼️`, '', '')
      } else {
        $util.notify(`首次写入 ${cookieName} Cookie 成功 🎉`, '', '')
      }
    }
  } else {
    $util.notify(`写入 ${cookieName} Cookie 失败‼️`, '', '无法读取请求头')
  }
}

function getDataTraffic(cookie) {
  return new Promise((resolve, reject) => {
    let options = {
      url: `${url}/user`,
      headers: {
        Cookie: cookie,
      },
    }
    $util.get(options, (error, response, data) => {
      let matcher = data.replace(/\n/g, '').match(/>可用：(.*?)<.*>已用：(.*?)</)
      if (matcher && matcher.length == 3) {
        checkinResult.rest = matcher[1]
        checkinResult.used = matcher[2]
      }
      resolve('done')
    })
  })
}

function checkin(cookie) {
  return new Promise(resolve => {
    let options = {
      url: `${url}/user/checkin`,
      headers: {
        Cookie: cookie,
      },
    }
    $util.post(options, (error, response, data) => {
      obj = JSON.parse(data)
      checkinResult.total = updateTotal(obj.msg)
      checkinResult.msg = obj.msg
      resolve('done')
    })
  })
}

function updateTotal(checkinMsg) {
  let total = $util.read(totalKey)
  if (total != (undefined || null)) {
    total = parseFloat(total)
  } else {
    total = 0.0
  }

  if (checkinMsg) {
    let matcher = checkinMsg.match(/(增加|减少)[^.\d]*(([1-9]\d*|0)(\.\d+)?)[^.\d]*/)
    if (matcher && matcher.length >= 3) {
      if (matcher[1] === '增加') {
        total += parseFloat(matcher[2])
      } else if (matcher[1] === '减少') {
        total -= parseFloat(matcher[2])
      }
    }
    $util.write(`${total}`, totalKey)
  }

  return total
}

/**
 * 该兼容方法来自 @nobyda https://github.com/NobyDa/Script
 */
function init() {
  const isRequest = typeof $request != 'undefined'
  const isSurge = typeof $httpClient != 'undefined'
  const isQuanX = typeof $task != 'undefined'
  const notify = (title, subtitle, message) => {
    if (isQuanX) $notify(title, subtitle, message)
    if (isSurge) $notification.post(title, subtitle, message)
  }
  const write = (value, key) => {
    if (isQuanX) return $prefs.setValueForKey(value, key)
    if (isSurge) return $persistentStore.write(value, key)
  }
  const read = key => {
    if (isQuanX) return $prefs.valueForKey(key)
    if (isSurge) return $persistentStore.read(key)
  }
  const get = (options, callback) => {
    if (isQuanX) {
      if (typeof options == 'string') options = { url: options }
      options['method'] = 'GET'
      return $task.fetch(options).then(
        response => {
          response['status'] = response.statusCode
          callback(null, response, response.body)
        },
        reason => callback(reason.error, null, null)
      )
    }
    if (isSurge) return $httpClient.get(options, callback)
  }
  const post = (options, callback) => {
    if (isQuanX) {
      if (typeof options == 'string') options = { url: options }
      options['method'] = 'POST'
      $task.fetch(options).then(
        response => {
          response['status'] = response.statusCode
          callback(null, response, response.body)
        },
        reason => callback(reason.error, null, null)
      )
    }
    if (isSurge) $httpClient.post(options, callback)
  }
  const done = (value = {}) => {
    if (isQuanX) isRequest ? $done(value) : ''
    if (isSurge) isRequest ? $done(value) : $done()
  }
  return { isRequest, isQuanX, isSurge, notify, write, read, get, post, done }
}
