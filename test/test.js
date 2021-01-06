assert = chai.assert;

describe('Request', function () {
  it('get_json', function (done) {
    bhreq.send({
      url: 'https://httpbin.org/get?arg1=1&arg2=2'
    }).then(function (res) {
      assert.equal(200, res.status);
      assert.equal('1', res.body.args.arg1);
      assert.equal('2', res.body.args.arg2);
      done();
    });
  });
  it('get_json_params_1', function (done) {
    bhreq.send({
      url: 'https://httpbin.org/get',
      params: { arg1: '1', arg2: '2' }
    }).then(function (res) {
      assert.equal(200, res.status);
      assert.equal('1', res.body.args.arg1);
      assert.equal('2', res.body.args.arg2);
      done();
    });
  });
  it('get_json_params_2', function (done) {
    bhreq.send({
      url: 'https://httpbin.org/get?arg1=1&arg2=2',
      params: { arg3: '3' }
    }).then(function (res) {
      assert.equal(200, res.status);
      assert.equal('1', res.body.args.arg1);
      assert.equal('2', res.body.args.arg2);
      assert.equal('3', res.body.args.arg3);
      done();
    });
  });
  it('post_json', function (done) {
    bhreq.send({
      url: 'https://httpbin.org/post',
      method: 'POST',
      body: { arg1: 1, arg2: 2 },
      contentType: 'application/json'
    }).then(function (res) {
      assert.equal(200, res.status);
      assert.equal(1, res.body.json.arg1);
      assert.equal(2, res.body.json.arg2);
      done();
    });
  });
  it('encode_decode_msgpack', function (done) {
    const date = Date.now;
    var enc1 = bhreq.msgpack.encode({
      num1: 1, str1: 'string1'
    });
    var enc2 = bhreq.msgpack.encode({
      str2: 'string2', num2: 2, sub: { arr: ['a', 1, 'azerty'], date: date }
    });
    var obj1 = bhreq.msgpack.decode(enc1);
    var obj2 = bhreq.msgpack.decode(enc2);
    assert.equal(1, obj1.num1);
    assert.equal('string1', obj1.str1);
    assert.equal(2, obj2.num2);
    assert.equal('string2', obj2.str2);
    done();
  });
  it('post_msgpack', function (done) {
    bhreq.send({
      url: 'https://httpbin.org/post',
      method: 'POST',
      body: { arg1: 1, arg2: 2 },
      contentType: 'application/x-msgpack'
    }).then(function (res) {
      assert.equal(200, res.status);
      done();
    });
  });
  it('put_form', function (done) {
    bhreq.send({
      url: 'https://httpbin.org/put',
      method: 'PUT',
      body: { arg1: 1, arg2: 2 },
      contentType: 'application/x-www-form-urlencoded'
    }).then(function (res) {
      assert.equal(200, res.status);
      assert.equal(1, res.body.form.arg1);
      assert.equal(2, res.body.form.arg2);
      done();
    });
  });
  it('get_jpg', function (done) {
    bhreq.send({
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/145px-The_Earth_seen_from_Apollo_17.jpg',
      responseType: 'blob'
    }).then(function (res) {
      assert.equal(200, res.status);
      assert.equal('blob', res.responseType);
      var img = document.createElement("IMG");
      img.src = window.URL.createObjectURL(res.body);
      document.lastElementChild.appendChild(img);
      done();
    });
  });
});
