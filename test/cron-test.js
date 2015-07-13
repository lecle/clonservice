/**
 * Created by LecleNote1 on 2015-07-13.
 */
var cronJob = require('../lib/cronServer');

var dummyContainer = {
   // addListener : function(){},
    getService : function(name) {

        return {
            then : function(callback){ callback({send : function(command, data, callback) {

                callback(null, {data : {masterKey : 'test'}});
            }});

                return {fail : function(){}};
            }
        };
    }
};

describe('cronJob', function() {
    describe('#init()', function () {
        it('should initialize without error', function (done) {

            cronJob.init(dummyContainer, function (err) {

                cronJob.close(done);
            });
        });
    });
});
