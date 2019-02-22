assert = chai.assert;

describe('Request', function () {
  it('get_json', function (done) {
    send({
      url: 'https://httpbin.org/get?arg1=1&arg2=2'
    }).then(function (res) {
      assert.equal(200, res.status);
      assert.equal('1', res.body.args.arg1);
      assert.equal('2', res.body.args.arg2);
      done();
    });
  });
  it('post_json', function (done) {
    send({
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
  it('put_form', function (done) {
    send({
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
    send({
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
