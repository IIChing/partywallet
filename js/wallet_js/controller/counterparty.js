/*
 * Counterparty.js - Controller
 * 
 * Defines most of the counterparty-related functions
 */
 counterparty = (function(){
    
    function ajaxRequest(data, callback){   
      var me   = this,
          net  = (QB_WALLET_NETWORK==2) ? 'testnet' : 'mainnet',
          info = SERVER_INFO[net],
          url  = ((info.cpSSL) ? 'https' : 'http') + '://' + info.cpHost + ':' + info.cpPort + '/api/',
          auth = base64.encode(info.cpUser + ':' + info.cpPass);

          console.log("current " + auth);
          // Stash the original success function for use later
          reqwest({
            url:url,
            method: 'post',
            crossOrigin:false,
            data: JSON.stringify(data),
            dataType: 'json',
            headers: {
              'Authorization': 'Basic ' + auth,
              'Content-Type': 'application/json; charset=UTF-8',
            },
            success: function(data){
              if(typeof callback === 'function')
                callback(data);
            },
          });
    };
    // Handle creating sends
    function create_send(source, destination, asset, quantity, fee, callback){
    // console.log('create_send=', source, destination, asset, quantity, fee);
      ajaxRequest( {
         method: "create_send",
         params: {
              source: source,
              destination: destination,
              asset: asset,
              quantity: parseInt(quantity),
              fee: parseInt(fee),
              allow_unconfirmed_inputs: true
         },
         jsonrpc: "2.0",
         id: 0
      }, callback);
    };


    // Handle creating broadcasts
     function create_broadcast(source, fee_fraction, text, timestamp, value, fee, callback){
        // console.log('create_broadcast=', source, fee_fraction, text, timestamp, value, fee);
        var me = this;
        ajaxRequest({
            jsonData: {
               method: "create_broadcast",
               params: {
                    source: source,
                    text: text,
                    value: parseFloat(value),
                    fee_fraction: parseFloat(fee_fraction),
                    fee: parseInt(fee),
                    timestamp: Math.round(new Date()/1000), // Use current unix time for timestamp
                    allow_unconfirmed_inputs: true
                },
                jsonrpc: "2.0",
                id: 0
            },            
            success: function(o){
                if(callback)
                    callback(o);
            }
        }, callback);

    };


    // Handle creating issuances
    function create_issuance(source, asset, quantity, divisible, description, destination, fee, callback){
        // console.log('create_issuance=', source, asset, quantity, divisible, description, destination, fee);
        var me = this;
        ajaxRequest({
            jsonData: {
               method: "create_issuance",
               params: {
                    source: source,
                    asset: asset,
                    quantity: parseInt(quantity),
                    divisible: parseInt(divisible),
                    description: description,
                    transfer_destination: (destination) ? destination : null,
                    fee: parseInt(fee),
                    allow_unconfirmed_inputs: true
                },
                jsonrpc: "2.0",
                id: 0
            },            
            success: function(o){
                if(callback)
                    callback(o);
            }
        }, callback);

    };


  return{
    create_broadcast,
    create_send
  }


})();

data['counterparty'] = counterparty;
