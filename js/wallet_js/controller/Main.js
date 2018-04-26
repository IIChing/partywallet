wallet = (function(counterparty){
  function launch(){
    //Create wallet Object
    var sm  = localStorage, // Alias for state manager
        wall = sm.getItem('wallet'),
        pass = sm.getItem('passcode'); 
    // use # to hash
    // Setup alias to counterparty controller
    //counterparty   = QB_app.getController('Counterparty');
    // Setup flag to indicate if we are running as a native app.
    //isNative = (typeof cordova === 'undefined') ? false : true;
    // Setup alias to device type 
    //deviceType = getDeviceType();
    // Initalize some runtime values 
    QB_PASSCODE       = 0000;                           // Default passcode used to encrypt wallet
    QB_WALLET_HEX     = null;                           // HD wallet Hex key
    QB_WALLET_KEYS    = {};                             // Object containing of address/private keys
    QB_WALLET_NETWORK = sm.getItem('network') || 2;     // (1=Mainnet, 2=Testnet)
    QB_WALLET_PREFIX  = sm.getItem('prefix')  || null;  // 4-char wallet hex prefix (used to quickly find addresses associated with this wallet in datastore)
    QB_WALLET_ADDRESS = sm.getItem('address') || null;  // Current wallet address info
    QB_TOUCHID        = sm.getItem('touchid') || false  
    QB_WALLET_TOUCHID        = sm.getItem('touchid') || false; // TouchID Authentication enabled (iOS 8+)
    QB_WALLET_NETWORK_INFO   = {};                             // latest network information (price, fees, unconfirmed tx, etc)
    QB_API_KEYS       = {
      BLOCKTRAIL: 'efb0aae5420f167113cc81a9edf7b276d40c2565'
    }

    SERVER_INFO = {
      mainnet: {
                 cpHost: 'public.coindaddy.io',          // Counterparty Host
                 cpPort: 14000,                           // Counterparty Port
                 cpUser: 'rpc',                          // Counterparty Username
                 cpPass: '1234',                         // Counterparty Password
                 cpSSL: true                             // Counterparty SSL Enabled (true=https, false=http)
               },
      testnet: {
                 cpHost: 'public.coindaddy.io',          // Counterparty Host
                 cpPort: 14001,                          // Counterparty Port
                 cpUser: 'rpc',                          // Counterparty Username
                 cpPass: '1234',                         // Counterparty Password
                 cpSSL: true                             // Counterparty SSL Enabled (true=https, false=http)
               }                           
    };

    // Define default miners fees (pull dynamic fee data from blocktrail.com API)
    var std = 0.0001
     QB_MINER_FEES = {
        standard: std,
        medium: std * 2,
        fast: std * 5
      }

    // Load any custom server information
    var serverInfo = sm.getItem('serverInfo');
    if(serverInfo){
      var o = base64.decode(serverInfo);
      if(o)
        SERVER_INFO = o;
    } 
    // Detect if we have a wallet
    if(wall){
          // Define function to run once we have successfully authenticated
          var successFn = function(pass){
              if(pass)
              QB_WALLET_PASSCODE = pass;
              decryptWallet();
              setWalletNetwork(QB_WALLET_NETWORK);
              setWalletAddress(QB_WALLET_ADDRESS, true);
              showMainView();
              // Load network info every 10 minutes
              var network  = store.get('networkInfo'),
                  tstamp   = store.get('networkInfoUpdated'),
                  interval = 600000; // 10 minutes
              if(network){
                  QB_NETWORK_INFO = network;
                // Parse in last known network fees 
                if(QB_NETWORK_INFO.fee_info){
                    var o = QB_NETWORK_INFO.fee_info;
                    QB_MINER_FEES.medium = o.low_priority;
                    QB_MINER_FEES.fast   = o.optimal;
                }
              }
              // Refresh if we have no network data, or it is older than interval
              if(!tstamp || (tstamp && (parseInt(tstamp)+interval) < Date.now()))
                  updateNetworkInfo(true);
              // Update prices every 10 minutes
              setInterval(function(){ updateNetworkInfo(true); }, interval);
              // Handle processing any scanned data after 1 second
              setTimeout(function(){ processLaunchData(); }, 1000);
          }
          if(pass){
            // Handle passcode authentication
            authenticatePasscode(successFn, null, 'Please enter your passcode', true);
          } else {
            successFn();
          }
      } else {
        // Show the welcome/setup view
        showWelcomeView(); 
    }
  }


 function processLaunchData(){
      if (typeof QB_LAUNCH_DATA !== 'undefined') {
        // the variable is defined
          var data = QB_LAUNCH_DATA;
      }
      // Only proceed if we have a decrypted wallet
      if(QB_WALLET_HEX && data){
          var o = getScannedData(String(data));
          processQRCodeScan(o); // Treat input as a scanned QR Code
          QB_LAUNCH_DATA = false;  // Reset data so it is gone on next check
      }
    }

 // Handle prompting user for passcode and validating it before allowing them to main app
 function authenticatePasscode(successFn, errorFn, text, force){
        var me   = this,
            text = (text) ? text: 'Please enter your passcode';
           showPasscodeView({
            title: text,
            cb: function(val){
                if(isValidPasscode(val)){
                    if(typeof successFn === 'function')
                        successFn(val);
                } else {
                    // Handle alerting user to invalid passcode, then re-authenticate
                    // Defer showing the message a bit to prevent a known issue in sencha-touch with showing messageboxes too fast
                    if(force){
                        setTimeout(function(){
                            alert(null,'Invalid passcode', function(){
                                authenticatePasscode(successFn, errorFn, text, force);
                            });
                        },10);
                    } else if(typeof errorFn === 'function'){
                        errorFn();
                    }
                }
            }
        });
    } 

    // Handle setting the user passcode and saving it to disk so we can validate it later
    function setPasscode(code){
            var sm = localStorage;
        if(code){
            QB_WALLET_PASSCODE = code;
            var enc = CryptoJS.AES.encrypt(String(QB_WALLET_PASSCODE), String(QB_WALLET_PASSCODE)).toString();
            sm.setItem('passcode', enc);
        }
    } 

    // Handle verifying if a given passcode is correct
    function isValidPasscode(code){
        var sm = localStorage,
            p  = sm.getItem('passcode');
        if(code){
            var dec = '';
            // Try to decrypt the encryptd passcode using the given passcode... catch any errors and treat as failures
            try {
                dec = CryptoJS.AES.decrypt(p, String(code)).toString(CryptoJS.enc.Utf8);
              }catch(e){
            }
            if(dec==code)
                return true
        }
        return false;
    }

  // Handle generating 128-bit mnemonic wallet, or using an existing wallet
  function generateWallet(phrase, callback){
    var sm = localStorage,
         m = new Mnemonic(128);
    
    sm.clear()
    store.clearAll();  
    // If passphrase was specified, use it
    if(phrase)
        m = Mnemonic.fromWords(phrase.trim().split(" "));
    // Generate wallet passphrase and hex
    var p  = m.toWords().toString().replace(/,/gi, " "),
        h  = m.toHex();
    // Save the wallet hex so we can use when adding the wallet addresses
     QB_WALLET_HEX = h.toString();
    // Generate ARC4-based PRNG that is autoseeded using the
    // current time, dom state, and other accumulated local entropy.
    // var seed = Math.seedrandom();
    //     list = CryptoJS.enc.Utf8.parse(seed),
    //     str  = CryptoJS.enc.Base64.stringify(list);
    // Encrypt the wallet and save it to disk so we can load on next run
    encryptWallet();
    // Set the wallet prefix to the first 5 chars of the hex
    QB_WALLET_PREFIX  = String(h.substr(0,5));
    prefix_string =  '"' + QB_WALLET_PREFIX + '"'; 
    sm.setItem('prefix', prefix_string );
    // Generate some wallet addresses for use
    addWalletAddress(2, 1, false); // Mainnet
    addWalletAddress(2, 2, false); // Testnet
    // Set wallet address to the first new address
    var addr = getFirstWalletAddress(QB_WALLET_NETWORK); 
    if(addr)
        setWalletAddress(addr, true);
    // Handle processing the callback
    if(typeof callback === 'function'){
        callback(p);
    }
  }

  // Handle for ajax requests
  // All requests should have success: function defined
  function ajaxRequest(request, force){    
    abjax.ajax({
      url: request.url,
      type: request.method,
      success: function(res, status){
          request.success(res)
      },
      error: function(res){
       //request.failure(res)
       console.log(res);
      },
      complete: function(res){
        if(request.callback)
           request.callback(res)
    
      }, //XHR only
      timeout:0,
      crossDomain: null
    });
  }
  
  // Handle updating misc network info (currency, fee, network info)
  function updateNetworkInfo(refresh){ 
    sm = store;    
    ajaxRequest({
      url: 'https://xchain.io/api/network',
      method: 'GET',
      success: function(o){
        if(o && o.currency_info){
          QB_NETWORK_INFO = o;
          // Save info to localStorage so we can preload last known prices on reload
          sm.set('networkInfo', o);
          sm.set('networkInfoUpdated', Date.now());
          // Update the miners fee info so we can use it in the transaction
          QB_MINER_FEES = Object.assign(QB_MINER_FEES,{       
              medium: o.fee_info.low_priority,
              fast: o.fee_info.optimal
          });
          // Update Balances list now that we have updated price info 
          if(refresh){
            if(balance = document.querySelector('.balance'))
              balance.reload()
              //location.reload(true) 
          }
        }
      }
    },true); 
  }

  // Handle requesting information on a given token
  function getTokenInfo (asset, callback){
      var me   = this,
          host = (FW.WALLET_NETWORK==2) ? 'testnet.xchain.io' : 'xchain.io';
      ajaxRequest({
          url: 'https://' + host + '/api/asset/' + asset,
          // Success function called when we receive a success response
          success: function(o){
              if(typeof callback === 'function')
                  callback(o);
          }
      });
  }

  save = (function(){
    
    var v = {}

    function write(o){
      
      function setValue(selector, input){ 
        if(o.cmp){
          return o.cmp.querySelector(selector).innerHTML = input;
        }
      }
      
      // create a global '$' variable
      $ = function(selector) {
          if(o.cmp){
            return o.cmp.querySelector(selector)
          }
      };

      
  }

    function walletInfo(o){
       v = Object.assign(o,v);
       if(Object.keys(v).length > 3){
          write(o)
       }
    }

    console.log(data) 
   
    // cloud numss weg benutz data json
    var cloud = []; 
    
    function add(o, callback){
      var v = [Object.keys(o)[0]];    
      switch(v.toString()){
        case'Transaction':
          if(Object.keys(o)[0].length !== 0){ 
            let t = o['Transaction'];
            cloud.push(t);
          }else{
            cloud[0] = value; 
          }
          break;     
      } 
    }

    return{
      walletInfo,
      add,
      getCloud: function(){
        return cloud;
      }
    }

  })();

  save.walletInfo({cash:'pepe'});
  
  // Handle setting the wallet network (1=mainnet/2=testnet)
  function setWalletNetwork(network, load ){
      // console.log('setWalletNetwork network, load=',network,load);
      var sm = localStorage,
          net = (network==2) ? 'testnet' : 'mainnet';
      // Update wallet network san d
      QB_WALLET_NETWORK = network;
      sm.setItem('network', network);
      // Change change window.NETWORK so thinks work nicely in util.bitcore.js
      window.NETWORK = bitcore.Networks[net];
      // Handle loading the first address for this network
      if(load){
          var addr = getFirstWalletAddress(network);
          if(addr)
              setWalletAddress(addr, true);
      }
    }

    // Handle setting the wallet address
    function setWalletAddress(address,load){
        // console.log('setWalletAddress address, load=',address,load);
        var sm        = localStorage,
            info      = false,
            prefix    = String(address).substr(0,5),
            addresses = store.get('Addresses'),
            balances  = store.get('Balances') ,
            history   = store.get('Transactions');
        // Remove any filters on the store so we are dealing with all the data
        //addresses.clearFilter();
        //balances.clearFilter();
        // Try to find wallet address information in the datastore

        for(var key in store.getAll()){
          store.transact(key, function(o){
            if(typeof(o)=='object' && key != 'Addresses' && o != 'null' && key != 'networkInfo' ){   
              if( o.address == address.replace(/['"]+/g, '') ){  
                info = o;
              }
            }
          });
        }

        // Only proceed if we have valid wallet information
        if(info){ 
            // Save current address info to statemanager
            sm.setItem('address',info.address)
            // Save the full wallet info
            QB_WALLET_ADDRESS = info;
            // Try to lookup settings panel and set/update address and label
            //console.log(info.address);
           
            save.walletInfo({
              address: info.address,
              label : info.label
            })
            
            // Handle loading address balances and history
            if(load){
                history = {};
                getAddressBalances(address);
                getAddressHistory(address);
            }
          /*
            // Filter stores to only display info for this address
            balances.filter('prefix', prefix);
            history.filter('prefix', prefix);
            // Handle updating any views which display the current address
            console.log(address)
            var view = Ext.getCmp('receiveView');
            view.address.setValue(address);
          */
      }
    }

   // Handle getting address balance information
   function getAddressBalances(address, callback){
        var addr   = (address) ? address : QB_WALLET_ADDRESS.address,
            prefix = addr.substr(0,5),
            stores  = store.get('Balances'),
            net    = (QB_WALLET_NETWORK==2) ? 'tbtc' : 'btc',
            hostA  = (QB_WALLET_NETWORK==2) ? 'tbtc.blockr.io' : 'btc.blockr.io',
            hostB  = (QB_WALLET_NETWORK==2) ? 'testnet.xchain.io' : 'xchain.io';
        // Get Address balance from blocktrail
        ajaxRequest({
            url: 'https://api.blocktrail.com/v1/' + net + '/address/' + address + '?api_key=' + QB_API_KEYS.BLOCKTRAIL,
            method: 'GET',
            success: function(o){
                if(o.address){
                    var quantity  = (o.balance) ? numeral(o.balance * 0.00000001).format('0.00000000') : '0.00000000',
                        price_usd = getCurrencyPrice('bitcoin','usd'),
                        price_btc = getCurrencyPrice('counterparty','btc'),
                        values    = { 
                            usd: numeral(parseFloat(price_usd * quantity)).format('0.00000000'),
                            btc: '1.00000000',
                            xcp: (price_btc) ? numeral(1 / price_btc).format('0.00000000') : '0.00000000'
                        };
                      
                    updateAddressBalance(address, 1, 'BTC','', quantity, values);
                    //saveStore('Balances');
                }
                // Handle processing callback now
                if(callback)
                    callback();
            },
            failure: function(o){
                // If the request to blocktrail API failed, fallback to slower blockr.io API
                  ajaxRequest({
                  url: 'https://' + hostA + '/api/v1/address/info/' + address, 
                  method: 'GET',
                  success: function(o){
                        if(o.data){
                            var quantity  = (o.data.balance) ? numeral(o.data.balance).format('0.00000000') : '0.00000000',
                                price_usd = getCurrencyPrice('bitcoin','usd'),
                                price_btc = getCurrencyPrice('counterparty','btc'),
                                values    = { 
                                    usd: numeral(price_usd * quantity).format('0.00000000'),
                                    btc: '1.00000000',
                                    xcp: (price_btc) ? numeral(1 / price_btc).format('0.00000000') : '0.00000000'
                                };
                            updateAddressBalance(address, 1, 'BTC','', quantity, values);
                      //      saveStore('Balances');
                        }
                    },
                    callback: function(){
                        // Handle processing callback now
                        if(callback)
                            callback();
                    }
                });
            }
        });
        // Get Asset balances
        ajaxRequest({
            url: 'https://' + hostB + '/api/balances/' + address,
            method: 'GET',
            success: function(o){  
                if(o.data){
                    for(var item=0; item<o.data.length; item++){   
                      var type = (item.asset=='XCP') ? 1 : 2;
                        updateAddressBalance(address, type, o.data[item].asset, o.data[item].asset_longname, o.data[item].quantity, o.data[item].estimated_value);
                    };
                }else{
                     updateAddressBalance(address, 1, 'XCP', '', '0.00000000'); 
                }
                //saveStore('Balances');
            }
        }, true);  
    }

   // Handle creating/updating address balance records in datastore
   function updateAddressBalance(address, type, asset, asset_longname, quantity, estimated_value){
        // console.log('updateAddressBalance address, type, asset, asset_longname, quantity, estimated_value=',address, type, asset, asset_longname, quantity, estimated_value);
        'use strict';
        var addr   = (address) ? address : QB_WALLET_ADDRESS,
            addr   = (address) ? address : QB_WALLET_ADDRESS,
            prefix = addr.substr(0,5);
            let balances = store.get('Balances') || [];
            let record = {};
            let current_id = 'Balances-' + prefix + '-' + asset;
            record = Object.assign(record, {
                id: prefix + '-' + asset,
                type: type,
                prefix: prefix,
                asset: asset,
                asset_longname: asset_longname,
                display_name: (asset_longname!='') ? asset_longname : asset,
                quantity: quantity,
                estimated_value: estimated_value
            });
            store.set( current_id , record);

            if(balances.indexOf(current_id) == -1){
              balances.push(current_id);
              store.set('Balances', balances )        
            }
    }
  
  // Handle displaying the current wallet passphrase 
  function showWalletPassphrase(){
    m  = Mnemonic.fromHex(QB_WALLET_HEX);
    p  = m.toWords().toString().replace(/,/gi, " ");
  }

  function getAddressHistory(address, callback){
    // Define callback function to call after getting BTC transaction history
    // var cb = function(){
    // getCounterpartyTransactionHistory(address, callback); }
    // Handle getting Bitcoin transaction data
       getTransactionHistory(address, callback);
  }

/*
 function storeData(name, subname, value){ 
   'use strict'; 
   var t = [];
    for(let i=0; i<value.length; i++){
        t.push(value[i])
        data[name][subname] = t; 

    }
    intoHTML(t);
 }

 //into HTML
 function intoHTML(t){ 
   'use strict';    
   ajaxRequest({
          // absolute path to html template
          url: 'static/js/pages/' + 'main' + '.html',
          
          success: function(r){
            let a = store.get('Balances');
            let x = [];
            
            if(a)
              for(let i=0; i<a.length; i++){
                x.push(store.get(a[i]))
                data['balances']['balances-list'] = x;
              }
 
           data['transactions']['transactions-list'] = t;
           
           function $id(id){return document.querySelector(id);}
           $id('#view').innerHTML = Mustache.to_html(r, data);  
            let walletId = $id('#wallet');

            console.log('afterparty ' + data['transactions']['transactions-list'] )
            
            save.walletInfo({cmp: walletId});
            if(typeof loadWindow !== "undefined")
              loadWindow();

          }
        });
  }
  */

 // Handle getting Bitcoin transaction history
 function getTransactionHistory(address, callback){
        var net   = (QB_WALLET_NETWORK==2) ? 'tbtc' : 'btc',
            hostA = (QB_WALLET_NETWORK==2) ? 'tbtc.blockr.io' : 'btc.blockr.io',
            hostB = (QB_WALLET_NETWORK==2) ? 'testnet.xchain.io' : 'xchain.io',
            types = ['bets','broadcasts','burns','dividends','issuances','orders','sends','mempool'];
        // Get BTC transaction history from blocktrail
            history_tx = []
        ajaxRequest({
            url: 'https://api.blocktrail.com/v1/' + net + '/address/' + address + '/transactions?limit=100&sort_dir=desc&api_key=' + QB_API_KEYS.BLOCKTRAIL,
            method: 'GET',
            tx : history_tx,
            success: function(o){
                 var item = o.data[0];
                if(item){
                 var time  = (item.block_height) ? moment(item.time,["YYYY-MM-DDTH:m:s"]).unix() : null,
                     value = numeral((item.estimated_value) * 0.00000001).format('0.00000000')
                      
                     if(item.inputs[0].address==address){
                        value = '-' + value;
                        updateTransactionHistory(address, item.hash, 'send', 'BTC', null, value , time);
                      }
                    
                      for(let i=0; i<o.data.length; i++){
                          var time  = (o.data[i].block_height) ? moment(o.data[i].time,["YYYY-MM-DDTH:m:s"]).unix() : null,
                              value = numeral((o.data[i].estimated_value) * 0.0000001).format('0.00000000');
                          if(o.data[i].inputs[0].address != address){
                            this.tx.push({asset:'BTC', quantity:value , tstamp:time, type: 'send', block:o.data[i].block_height, source: o.data[i].inputs[0].address, dest: o.data[i].outputs[0].address, hash: o.data[i].hash})
                          }else{
                            value = '-' + value;
                            console.log(o.data[i]);
                            this.tx.push({asset:'BTC', quantity:value , tstamp:time, type: 'send', block: o.data[i].block_height, source: o.data[i].inputs[0].address, dest: o.data[i].outputs[0].address, hash: o.data[i].hash}) 
                          }

                          if(i == o.data.length-1){
                            historyView(this.tx) 
                          }
                      }
                }else{
                  historyView('newAdress'); 
                }
                
                // Loop through transaction types and get latest transactions
                //saveStore('Transactions');
                // Handle processing callback now
                if(callback)
                    callback();

            },
            failure: function(o){
                // If the request to blocktrail API failed, fallback to slower blockr.io API
                ajaxRequest({
                    url:'https://' + hostA + '/api/v1/address/txs/' + address,
                    tx : history_tx,
                    method: 'GET',
                    success: function(o){
                       if(o.data && o.data.txs){
                            for(var i =0; i < o.data.txs.length; i++ ){
                                // Only pay attention to the last 100 transactions
                                if(idx<99){
                                    var time = moment(item.time_utc,["YYYY-MM-DDTH:m:s"]).unix();
                                    updateTransactionHistory(address, item.tx, 'send', 'BTC', null, item.amount, time);
                                } 
                            }
                            //saveStore('Transactions');
                        }
                        // Handle processing callback now
                        if(callback){
                            callback();
                        }
                    },
                    failure: function(o){
                        if(callback){
                            callback();
                        }
                    }
                  
                }); 
            }
            
        });        
          //-----------------------------------------------------
          function historyView(tx){ 
          var historytx = []; 
          for(var t=0; t< types.length; t++ ){
              ajaxRequest({
                  url: 'https://' + hostB + '/api/' + types[t] + '/' + address,
                  method: 'GET',
                  type: types[t],
                  hs: historytx,
                  success: function(o){
                    if(o){
                            
                          // Strip trailing s off type to make it singular
                          if(String(this.type).substring(this.type.length-1)=='s'){
                            type = String(this.type).substring(0,this.type.length-1);
                          // Loop through data and add to transaction list 
                          } else{
                            type = this.type;
                          }

                             
                            for(let i=0; i < o.data.length; i++){
                                var item = o.data[i];
                                var asset    = item.asset,
                                    quantity = item.quantity,
                                    tstamp   = item.timestamp,
                                    tx_type  = type;
                                
                            console.log(item);
                                // Set type from mempool data, and reset timestamp, so things show as pending
                                if(tx_type=='mempool'){
                                    tx_type = String(i.tx_type).toLowerCase();
                                    tstamp  = null;
                                    //console.log('hype' + types[t]); 
                                }
                                if(tx_type=='bet'){
                                    asset    = 'XCP';
                                    quantity = item.wager_quantity;
                                } else if(tx_type=='burn'){
                                    asset    = 'BTC';
                                    quantity = item.burned;
                                } else if(tx_type=='order'){
                                    asset    = item.get_asset,
                                    quantity = item.get_quantity;
                                } else if(tx_type=='send'){
                                    if(item.source==address)
                                        quantity = '-' + quantity;
                                }
                                if(store.get('logo')){
                                
                                }

                                this.hs.push({asset:asset, quantity: quantity, tstamp:tstamp, source: item.source, status: item.status, type: tx_type, block:item.block_index, hash: item.tx_hash})
                                
                                 
                updateTransactionHistory(address, item.tx_hash, tx_type, asset, item.asset_longname, quantity, tstamp);
                
                            }
                       
                               //var hs = this.hs;
                               ajaxRequest({
                                      // absolute path to html templatei
                                      type: type,
                                      bhs:tx,
                                      chs:this.hs,
                                      url: 'static/js/pages/' + 'main' + '.html',
                                      success: function(r){
                                        let a = store.get('Balances');
                                        let viewhs = [];
                                        let f = [];
                                        let bhs = this.bhs; 
                                        let chs = this.chs;


                                        if(this.type =='mempool'){ 
                                          if(a){
                                            for(let i=0; i<a.length; i++){
                                              f.push(store.get(a[i]))
                                               data['balances']['balances-list'] = f;
                                              }
                                            }                                

                                            // Bitcoin publick & testnet api
                                            data['settings']['network'] = SERVER_INFO;

                                            // Render history into view
                                            let hsMix = chs.concat(bhs);
                                            var valueArr = hsMix.map(function(item){ return item.hash });
                                            
                                            valueArr.some(function(el, i){ 
                                                  if(valueArr.indexOf(el) == i)
                                                    viewhs.push(hsMix[i]);
                                            });
                                            
                                            //sort data by tstamp
                                            viewhs.sort(function(a, b) {return  b.tstamp - a.tstamp; });
                                            data['transactions']['transactions-list'] = viewhs; 
                                            data['cpSend'] = cpSend;
                                           } 

                                           function $id(id){return document.querySelector(id);}
                                          

                                            $id('#view').innerHTML = Mustache.to_html(r, data);  
                                            let walletId = $id('#wallet');
           
                                            //page varible
                                            var c="";
                                            // set Main page  page1|page2|page3|page4
                                            firstPage = 'page3'; 
                                            if(walletId){

                                              m=walletId.querySelectorAll("#wallet-menu a")
                                              // search for all li a element
                                              for (i = 0; i < m.length; i++) {
                                                 
                                                $id('#' + firstPage ).style.display ='block';
                                                m[i].addEventListener('click', function() { 
                                                if (c.length) { 
                                                      $id("#"+c).style.display = 'none';
                                                }

                                                // save current page name
                                                c = this.getAttribute('data-page');
                                                $id("#"+ c).style.display = 'block';
                                                 
                                                // if first page is not clicked 
                                                if( c !== firstPage )
                                                  $id('#' + firstPage).style.display ='none'
                                              });
                                              }
                                            }

                                            if(typeof init !== "undefined"){
                                              //newAdress
                                              let balances = store.get('Balances');
                                              if(balances == null){
                                                    setTimeout(function(){
                                                        location.reload();
                                                    },500);
                                              } else{
                                                init(walletId, balances);
                                              }
                                            }
                                          }
                                    });
                    
                //-------------------------------------------------------------------------------------------------------
                          //me.saveStore('Transactions');
                      }

                  }

              });
          }   
          }

        
    }

 // Handle creating/updating address transaction history
 function updateTransactionHistory(address, tx, type, asset, asset_longname, quantity, timestamp){
        // console.log('updateTransactionHistory address, tx, type, asset, asset_longname, amount, timestamp=', address, tx, type, asset, asset_longname, quantity, timestamp);
        var me     = this,
            addr   = (address) ? address : QB_WALLET_ADDRESS.address,
            cloud  = save.getCloud() 
            time   = (timestamp) ? timestamp : 0,
            record = {};
        // Get currenct record info (if any)
         for(key in cloud){
          if(cloud[key].hash==tx){
              record = {};
              return false;                
          }
        }
        
        // Bail out if this is already a known transaction
        if(asset=='BTC' && typeof record.hash !== 'undefined')
            return;
        var rec = {
              id: addr.substr(0,5) + '-' + tx.substr(0,5),
              prefix: addr.substr(0,5),
              type: type,
              hash: tx,
              asset: (asset_longname) ? asset_longname : asset
          };
          
        
          // Only set amount if we have one
        if(quantity)
            rec.quantity = String(quantity).replace('+','')
        // Only set timestamp if we have one
        if(time)
            rec.time = time;

        var m = Object.assign( rec, record )
        console.log('updateTransaction' + m);
        record = save.add({'Transaction': m });
         
        //save.add(Ext.applyIf(rec, record));
        // Mark record as dirty so that we save to disk on next sync
        //records[0].setDirty();
    } 

  // Handle encrypting wallet information using passcode and saving
  function encryptWallet(){
    var sm = localStorage;
    // Encrypt the wallet seed
    var enc = CryptoJS.AES.encrypt(QB_WALLET_HEX, String(QB_PASSCODE)).toString();
    sm.setItem('wallet', enc);
    // Encrypt any imported private keys
    var enc = CryptoJS.AES.encrypt(base64.encode(QB_WALLET_KEYS), String(QB_PASSCODE)).toString();
    sm.setItem('privkey', enc); 
  }

  // Handle decrypting stored wallet address using passcode
   function decryptWallet(){
    var sm = localStorage,
        w  = sm.getItem('wallet'),
        p  = sm.getItem('privkey');
      // Decrypt wallet
      if(w){
          w = w.replace(/['"]+/g, '')
          var dec = CryptoJS.AES.decrypt(w, String(QB_PASSCODE)).toString(CryptoJS.enc.Utf8);
          QB_WALLET_HEX = dec;
      }
      // Decrypt any saved/imported private keys
      if(p){
          p = p.replace(/['"]+/g, '')
          var dec = CryptoJS.AES.decrypt(p, String(QB_PASSCODE)).toString(CryptoJS.enc.Utf8);
          QB_WALLET_KEYS = base64.decode(dec);
      } 
  }

  // Handle adding wallet addresses
  // @count   = number of addresses to generate
  // @network = 1=livenet / 2=testnet
  // @force   = force generation of address count
  // @alert   = show alert for first address added
  // 
  function addWalletAddress(count, network, force, alert){
    var me       = this,
        addr     = null,
        network  = (network) ? network : QB_WALLET_NETWORK,
        bc       = bitcore,
        n        = (network==2) ? 'testnet' : 'mainnet',
        force    = (force) ? true : false,
        net      = bc.Networks[n],
        key      = bc.HDPrivateKey.fromSeed(QB_WALLET_HEX, net);   // HD Private key object
        count    = (typeof count === 'number') ? count : 1,
        store    = store.get('Address') || store,        
        //addresses = store;
        total    = 0;
    // Remove any filters on the store so we are dealing with all the data
    // store.clearFilter();
    // Handle generating wallet addresses and adding them to the Addresses data store
    for( var i = 0; total<count; i++){
        var derived = key.derive("m/0'/0/" + i),
            address = bc.Address(derived.publicKey, net).toString();
            found   = false;
       
        // Check if this record already exists
        for(property in rec ){ 
          if(property =='address'){
              found = true;
              return false;
          }
        }
      
        // Increase total count unless we are forcing address generation
        if(!force)
            total++;
        // Add address to datastore
        if(!found){
          if(force)
                total++;
          var current_id = QB_WALLET_PREFIX + '-' + network + '-' + (i+1)
          var rec = store.set(current_id, {
            id: current_id ,
            index: i,
            prefix: QB_WALLET_PREFIX,
            network: network,
                address: address,
                label: 'Address #' + (i+1)
        
            });

          //  saveStore(address);
            // Mark record as dirty so we save to disk on next sync
            addr = address;
        }
    }
    saveStore('Addresses', network)
    if(alert)
        alert('New Address', addr);
    return addr;
  }

  // Adresses List 
  function saveStore(storeName, network){
    var b = store.get(storeName) || [];
    console.log(b);

    for( let i = 0; i<total; i++){
      if(storeName == 'Addresses'){
      let current_id = QB_WALLET_PREFIX + '-' + network + '-' + (i+1);
      b.push(current_id)
      }
    }
    // Re-s/erialize the object back into a string and store it in
    store.set(storeName,b);
  }

  // Handle getting first address for a given network
  function getFirstWalletAddress(network){
    var addr = false;
    // Remove any filters on the store so we are dealing with all the data
    //store.clear();
    // Locate the first address
    for(var key in store.getAll()){
      store.transact(key, function(o) {         
      if(typeof(o)=='object' && key != 'Addresses' && key != 'Wallet'){  
          if(o.network==network && o.prefix==QB_WALLET_PREFIX && o.index==0){
            addr = o.address; 
          }
        }
      });
    }
    return addr;
  }

// Handle getting a price for a given currency/type
 function getCurrencyPrice(currency, type){
    let value = false,o;
    if( QB_NETWORK_INFO != null){ 
      o = QB_NETWORK_INFO.currency_info 
      for( item in o){
        if(o[item].id==currency){
              if(type=='usd')
                  value = o[item].price_usd;
              if(type=='btc')                
                  value = o[item].price_btc;
          }   
      }
      return value;
    }
  }

  // Handle getting a balance for a given asset
  function getBalance(asset){
      var balances = store.get('Balances'),
          balance  = 0,
          prefix   = QB_WALLET_ADDRESS.address.substr(0,5);
       balances.forEach(function(item){
         rec = store.get(item)  
         if(rec.prefix==prefix && rec.asset==asset){
              balance = rec.quantity;
              return false;
          }
      });
      return balance;
    }

        // Handle signing a transaction
    function signTransaction (network, source, unsignedTx, callback){
        var me       = this,
            bc       = bitcore,
            callback = (typeof callback === 'function') ? callback : false;
            net      = (network==2) ? 'testnet' : 'mainnet',
            privKey  = getPrivateKey(network, source)
            cwKey    = new CWPrivateKey(privKey);
        // update network (used in CWBitcore)
        NETWORK  = bc.Networks[net];
        // Callback to processes response from signRawTransaction()
        var cb = function(x, signedTx){
            if(callback)
                callback(signedTx);
        }
        CWBitcore.signRawTransaction(unsignedTx, cwKey, cb);
    }

    // Handle broadcasting a given transaction
    function broadcastTransaction(network, tx, callback){
        var me  = this,
            net  = (network==2) ? 'BTCTEST' : 'BTC';
            host = (FW.WALLET_NETWORK==2) ? 'testnet.xchain.io' : 'xchain.io',
        // First try to broadcast using the XChain API
           ajaxRequest({
            url: 'https://' + host + '/api/send_tx',
            method: 'POST',
            params: {
                'tx_hex': tx
            },
            success: function(o){
                var txid = (o && o.tx_hash) ? o.tx_hash : false;
                if(callback)
                    callback(txid);
            },
            failure: function(){
                // If the request to XChain API failed, fallback to chain.so API
                 ajaxRequest({
                    url: 'https://chain.so/api/v2/send_tx/' + net,
                    method: 'GET',
                    jsonData: {
                        tx_hex: tx
                    },
                    failure: function(){
                        if(callback)
                            callback();
                    },
                    success: function(o){
                        var txid = (o && o.data && o.data.txid) ? o.data.txid : false;
                        if(callback)
                            callback(txid);
                    }
                },true);
            }
        },true);
    }


   // Handle displaying an error message and making a callback request
    function cbError(msg, callback){
        alert('Error',msg);
        if(typeof callback === 'function')
            callback();
    } 

    // Handle generating a send transaction
   function cpSend(network, source, destination, currency, amount, fee, callback){
          // console.log('cpSend network, source, destination, currency, amount, fee=', network, source, destination, currency, amount, fee);
          var me = this,
              cb = (typeof callback === 'function') ? callback : false; 
          // Handle creating the transaction
            console.log(counterparty); 
            data.counterparty.create_send(source, destination, currency, amount, fee, function(o){
              
              console.log("show  some Result" + o);
              
              if(o && o.result){
                  // Handle signing the transaction
                   signTransaction(network, source, o.result, function(signedTx){
                      if(signedTx){
                          // Handle broadcasting the transaction
                           broadcastTransaction(network, signedTx, function(txid){
                              if(txid){
                                  if(cb)
                                      cb(txid);
                              } else {
                                 cbError('Error while trying to broadcast send transaction', cb);
                              }
                          });
                      } else {
                        cbError('Error while trying to sign send transaction',cb);
                      }
                  });
              } else {
                  var msg = (o.error && o.error.message) ? o.error.message : 'Error while trying to create send transaction';
                    cbError(msg, cb);
                  console.log('ERROR SEND ' + o);
              }
          });
      }

    // Handle getting a private key for a given network and address
    function getPrivateKey(network, address){
            bc    = bitcore,
            n     = (network==2) ? 'testnet' : 'mainnet',
            net   = bc.Networks[n],
            key   = bc.HDPrivateKey.fromSeed(QB_WALLET_HEX, net),   // HD Private key object
            priv  = false,
            index = false;
        // Check any imported/saved private keys
        var priv = QB_WALLET_KEYS[address];
        // Loop through HD addresses trying to find private key
        if(!priv){
            // Try to lookup the address index in store

            for(var key in store.getAll()){
              store.transact(key, function(o){
                if(typeof(o)=='object' && key != 'Addresses' && o != 'null' && key != 'networkInfo' ){   
                  if( o.address == address.replace(/['"]+/g, '') ){  
                    index = o.index;
                  }
                }
              });
            }
            // If we have an index, use it
            if(index!==false){
                var derived = key.derive("m/0'/0/" + index);
                priv = derived.privateKey.toWIF();
            } else {
                // Loop through first 50 addresses trying to find
                for(var i=0; i<50; i++){
                    var derived = key.derive("m/0'/0/" + index),
                        addr    = bc.Address(derived.publicKey, net).toString();
                    if(address==addr)
                        priv = derived.privateKey.toWIF();
                }
            }
        }
        return priv;
    }

  // Handle prompting user to enter a wallet passphrase
  function promptWalletPassphrase(e,callback){
          var value = $id('#wallet_address').value;
          var yes = $id('#yes');
          
          console.log(e.type);
          
          alertbox({
            confirms: function(){
             let btn = e.type;
             fn(btn, value);
            },
            cancel: function (){      
              return 'error';
            },
            btn : [yes]
          });

          function fn(btn, val){
                // Handle validating that the entered value is a valid passphrase
                console.log(btn);
                  if(btn=='click'){
                    var valid = false,
                        arr   = val.trim().split(" ");
                    // Validate that the passphrase is 12 words in length and all words are on the wordlist
                    if(arr.length==12){
                        valid = true;
                        arr.forEach(function(item){
                            if(Mnemonic.words.indexOf(item)==-1){
                                valid = false;
                                return false;
                            }
                        });
                    }
                    // Handle creating wallet using given passphrase
                    if(valid){
                        if(typeof callback === 'function')
                            callback(val);
                    } else { 
                      setTimeout(function(){
                                alert('Invalid Passphrase'); 
                                  setTimeout(function(){
                                    promptWalletPassphrase(callback) 
                                },10);
                            
                        },10);
                    }

                }
            }
    } 

  function redirect(page){ 
      let url  =  window.location.pathname + '#' + page;
      location.replace(url);
  }

  function confirmbox(classname){
    classname.onclick = function(){
      location.reload();
      redirect(showMainView());
     
    }
    /*
    no.oncklick = function(){
    
    }
    */
  }

  // remove logout & o.atbox.className = return yes & no instead 
  function alertbox(o){ 
    
    if(o.div){ 
      o.div.classList.remove("hidden");
      let btn1 = o.div.querySelector('.yes'),
          btn2 = o.div.querySelector('.no');
      o.div.querySelector('.alert-title').innerHTML = o.title ;
      o.div.querySelector('.alert-text').innerHTML =  o.text;

      btn1.onclick = function(){
          o.confirms();
      }
      btn2.onclick = function(){
        o.cancel();     
      }
    }

  }
  
  function showWelcomeView(){
    wall = store.get('wallet');
    if(!wall){
      return 'welcome';
    }else{
      redirect('main');
    }
  }

  function showMainView(){ 
    wall = store.get('wallet');
    if(wall){
      return 'main'}
    else{
      redirect('')
    }
  }


  function loadHTML(o) { 
    ajaxRequest({
    url: 'static/js/pages/' + o.file + '.html',
      success: function(r){
      function $(id){return document.querySelector(id);}
      $id('#view').innerHTML = Mustache.to_html(r, o.data); 
      let button; 
      if( button = $('#genpass')){ 
        button.addEventListener("click", function(e){
          createWallet();    
        });
      }
      if( button = $('#yes')){
        button.addEventListener("click", function(e){
          existingWallet(e);
        });
      }
    }})
  }

  //ROUTER ------------------------------------------------------------
  router = new Navigo(null, true, '#');
  router.on({
    // '#view' is the id of the div element inside which we render the HTML
    'main': function(){ 
      if(showMainView() === 'main') 
        loadHTML({file:showMainView(), data: data, id:'#view' }); 
    },
    'login': function(){ loadHTML( {file: 'login_wallet', data:data, id:'#view'})},
    'create': function(){ loadHTML({file: 'create_wallet', data:data, id:'#view'})}, 
    '/': function(){  loadHTML({file:showWelcomeView(), data:data , id:'#view'})}, 
  });


  // set the 404 route
//  router.notFound((query) => { $id('view').innerHTML = '<h3>Couldn\'t find the page you\'re looking for...</h3>'; })
  // Handle creating a wallet, and displaying it to the user 
  router.resolve();
  
  return{
    launch,
    processLaunchData,
    confirmbox,
    alertbox,
    redirect,
    loadHTML,
    getBalance,
    getTokenInfo,
    showWelcomeView,
    generateWallet,
    getCurrencyPrice,
    promptWalletPassphrase,
    showPassphraseView: function(p){
      let passValue = $id('#passphrase').value = p;
      if(passValue){
        confirmbox($id('.yes') )
      }
    },
  }
})();
wallet.launch();
