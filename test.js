
const { MTProto } = require('@mtproto/core');

const api_id = '987086';
const api_hash = '8fb7bdd115133bf84cfaaf85fa14f061';

var mtproto;



mtproto = new MTProto({
      api_id,
      api_hash,
});

const api = {
  call(method, params, options = {}) {
    return mtproto.call(method, params, options).catch(async error => {
      console.log(`${method} error:`, error);

      const { error_code, error_message } = error;

      if (error_code === 303) {
        const [type, dcId] = error_message.split('_MIGRATE_');

        // If auth.sendCode call on incorrect DC need change default DC, because call auth.signIn on incorrect DC return PHONE_CODE_EXPIRED error
        if (type === 'PHONE') {
          await mtproto.setDefaultDc(+dcId);
        } else {
          options = {
            ...options,
            dcId: +dcId,
          };
        }

        return this.call(method, params, options);
      }

      return Promise.reject(error);
    });
  },
};
// 1. Create an instance


// 2. Get the user country code
api.call('help.getNearestDc').then(result => {
    console.log(result);    
});
mtproto.call('auth.exportLoginToken', {
    api_id,
    api_hash,
    except_ids: []
}).then(result => {        
    console.log(result);   
    var binary = '';
    var len = result.token.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( result.token[ i ] );
    }
    console.log(Buffer.from(result.token, 'binary').toString('base64'));
}).catch(console.error)