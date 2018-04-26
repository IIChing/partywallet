data = {  
  welcome:{
      title: 'Welcome Page',
      descrb: 'Please click a button  below to indicate if you would like to generate a new wallet, or use an existing passphrase',
      info: 'You should only have to complete this wallet setup process once, after which  your wallet is encrpyted and saved to your device or browser.'
    }, 
   create:{
      title: 'Create New Wallet',
    },
   settings : {
       title: 'Wallet Information',
       lableTxt: 'label',
       addressTxt: 'Address',
       'label': function (value){
          return value;
        }, 
       'address': function (value){
          return value;
        }, 
    },
    balances: {
      toUpper: function(){
        return function(val, render){
          val = render(val)
          return String(val).toUpperCase();
        }
      },
      numberFormat: function(){
          var fmt = '0,0',
              //for(i in values) 
              qty = this.quantity;
          if(/\./.test(qty) || this.asset=='BTC')
              fmt += '.00000000';

          return numeral(qty).format(fmt);  
      },
      priceFormat: function(){
        var txt = '';
        if(this.estimated_value && this.estimated_value.usd!='0.00')
            var txt = '$' + numeral(this.estimated_value.usd).format('0,0.00');
        return txt;
      }
    },
    transactions :{
     getIcon: function(){
        var type = this.type,
            src  = 'resources/images/icons/btc.png';
        if(type=='bet'){
            src = 'resources/images/icons/xcp.png';
        } else if(type=='broadcast'){
            src = 'resources/images/icons/broadcast.png';
        } else if(type=='dividend'){
            src = 'resources/images/icons/dividend.png';
        } else if((type=='send'||type=='order'||type=='issuance') && this.asset!='BTC'){
            src = 'https://xchain.io/icon/'  + String(this.asset).toUpperCase() + '.png';
        }

        return src ;
    },
    numberFormat: function(){

        var qty  = String(this.quantity).replace('-','');
        return qty;  
    },
    toLower: function(val){
        return function(val, render){
          val = render(val)
          return String(val).toLowerCase();
        }
    },
    getDescription: function(){
        var str  = '',
            fmt  = '0,0',
            type = this.type,
            amt  = String(this.quantity).replace('-','');
        if(type=='send'){
            str = (/\-/.test(this.quantity)) ? 'Sent ' : 'Received ';
        } else if(type=='bet'){
            str = 'Bet ';
        } else if(type=='broadcast'){
            str = 'Counterparty Broadcast';
        } else if(type=='burn'){
            str = 'Burned ';
        } else if(type=='dividend'){
            str = 'Paid Dividend on ';
        } else if(type=='issuance'){
            str = 'Counterparty Issuance';
        } else if(type=='order'){
            str = 'Order - Buy ';
        }
        if(type=='send'||type=='bet'||type=='burn'||type=='order'){
            if(/\./.test(amt) || this.asset=='BTC')
                fmt += '.00000000';
            str += numeral(amt).format(fmt);
        }
        return str;
    },
    getDate: function(){
      if(this.tstamp){
        // Multiply by 1000 because JS works in milliseconds instead of the UNIX seconds
        let date = new Date( this.tstamp * 1000),
          year = date.getUTCFullYear(),
          month = date.getUTCMonth() + 1, // getMonth() is zero-indexed, so we'll increment to get the correct month number
          day = date.getUTCDate(),
          hours = date.getUTCHours(),
          minutes = date.getUTCMinutes(),
          seconds = date.getUTCSeconds();

        month = (month < 10) ? '0' + month : month;
        day = (day < 10) ? '0' + day : day;
        hours = (hours < 10) ? '0' + hours : hours;
        minutes = (minutes < 10) ? '0' + minutes : minutes;
        seconds = (seconds < 10) ? '0' + seconds: seconds;

        return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
      }else{
        return 'Pending';
      }
    },
    },
    login : {
      title: 'Please enter your<br/>12-word passphrase' 
    },
    tools: {

      id: function(id) {
        return document.querySelector(id);
      },
      // Handle converting an amount to satoshis
      getSatoshis: function(amount){
        console.log('my amount ' +  amount );
        var num = numeral(amount);
        if(/\./.test(amount))
            num.multiply(100000000); 
        console.log('outPut  ' +  parseInt(num.format('0')));
        return parseInt(num.format('0'));
      },

    // Handle looking up asset balance and updating field
    updateBalance: function(form, o, asset){
        var me      = this,
            prefix  = QB_WALLET_ADDRESS.address.substr(0,5),
            balance = 0,
            values  = false,
            format  = '0,0',
            total_price;
            // Find balance in store
            if(o.prefix==prefix){
                balance = o.quantity;
                values  = o.estimated_value;
                
                // calc the exchange rate
                exRate = balance / values.usd; 
            }
 
            QB_NETWORK_INFO.currency_info.forEach(function(item){
              if(item.symbol == asset){
                  total_price = item.price_usd ;
              }
            });
            
        // If balance is divisible, update display format and precision
        if(/\./.test(balance)){
            format += '.00000000';
            //me.amount.setDecimalPrviwecision(8);
            Number(me.amount).toPrecision(8)
        } else {
            Number(me.amount).toPrecision(0)
            //me.amount.setDecimalPrecision(0);
        }

        me.balance = balance;
        // Set max and available amount
        let bal = numeral(balance),
            amt = bal.format(format);
        // Display price in USD
        if(values.usd!='0.00')
            amt += ' ($' + numeral(values.usd).format('0,0.00') + ')';
        let b = me.id('#balance'),
            p = me.id('#price'),
            a = me.id('#amount');

            b.innerHTML = amt;
          
            a.value = "0.00000000";
            p.value = "0.00";
            
            a.addEventListener('input', function(e) { 
               // if not a letter 
               if(!isNaN(parseInt(e.target.value))){
                p.value = numeral(total_price * e.target.value).format('0.00');
               }else{
                p.value = "0.00";
               }
            });

            p.addEventListener('input', function (e) {
              // if not a letter 
               if(!isNaN(parseInt(e.target.value))){
                  // calc the exchange rate * 
                  a.value = numeral(e.target.value * exRate).format('0.00000000');
               }else{
                a.value = "0.00000000";
               }
            });
            
    },

    // Handle determining the miner fee
    setFee: function(val){
        var me  = this,
            o   = QB_MINER_FEES,
            avg = 250,    //530 Average transaction size (https://tradeblock.com/bitcoin/historical/1h-f-tsize_per_avg-01101)
            fee = 0.0001; // Minimum transaction fee
        if(o && val != 1){
            switch(val){
              case 2:
                fee = ((o.medium / 1000) * avg)  * 0.00000001;
              break;
              case 3:
               fee = ((o.fast / 1000) * avg) * 0.00000001;
              break;
            }
        }
        me.id('#fee').innerHTML = numeral(fee).format('0,0.00000000');
    },
   
      // Handle validating the send data and sending the send
      validate: function(e){
          console.log(this);
          var me = this,
              dest    = me.id('#address').value,
              asset = me.id('select#select-token option[value]').value
              msg     = false,
              amount  = String(me.id("#amount").value).replace(',',''),
              amt_sat = me.getSatoshis(amount),
              fee_sat = me.getSatoshis(String(me.id('#fee').innerHTML).replace('BTC','')),
              bal_sat = me.getSatoshis(wallet.getBalance('BTC'))
              available = data.tools.balance;
              console.log("amount " +  amt_sat + ' fee ' + fee_sat + ' Mulsti ' + amt_sat + fee_sat +  "> " + " bala " +  bal_sat)
          // Verify that we have all the info required to do a send
          if(amount==0){
              msg = 'You must enter a send amount';
              console.log(msg);
          } else if(dest.length<25 || dest.length>34 || !CWBitcore.isValidAddress(dest)){
              msg = 'You must enter a valid address';
              console.log(msg);
          } else {

              console.log('fee ' + fee_sat + ' > Balance ' + bal_sat)
              if(fee_sat > bal_sat)
                  msg = 'BTC balance below required amount.<br/>Please fund this address with some Bitcoin and try again.';
              if(asset=='BTC' && (amt_sat + fee_sat) > bal_sat)
                  msg = 'Total exceeds available amount!<br/>Please adjust the amount or miner fee.';
              if(asset!='BTC' && parseFloat(amount) > parseFloat(me.balance))
                  msg = 'Amount exceeds balance amount!';
          }
          if(msg){
              alert(msg);
              return;
          }
          // Define call function to run when we are sure user wants to send transaction
          var fn = function(){
              // Show loading screen while we are processing the send
 
              // Define callback called when transaction is done (success or failure)
              var cb = function(txid){
                 setMasked(false);
                  if(txid){
                      alert('Your transaction has been broadcast');
                        dest.reset();
                        amount.reset();
                        //me.priority.reset();
                        me.id('#fee').value='';
                  }
              };
              // Convert amount to satoshis
              amt_sat = (/\./.test(available)) ? amt_sat : String(amount).replace(/\,/g,'');
              data.cpSend(QB_WALLET_NETWORK, QB_WALLET_ADDRESS.address, dest, asset, amt_sat, fee_sat, cb);
          }
          // Confirm action with user
          console.log(this)
         // var asset = (me.tokenInfo.asset_longname && me.tokenInfo.asset_longname!='') ? me.tokenInfo.asset_longname : me.tokenInfo.asset;
          var alertDiv = me.id(".alert");
          /*
          alertbox('Confirm Send', 'Send ' + amount + ' ' +  asset +'?', function(btn){
              if(btn=='yes')
                  fn();
          });
          */
          wallet.alertbox({
            div: alertDiv,
            title:"Confirm Send",
            text:"Send you realy wannt's to send " + amount + " " +  asset ,
            confirms: function(){
              this.cancel()
              fn();
            }, 
            cancel: function(){
              this.div.className += " hidden";
            },
          });
      }
    },
    // Handle requesting basic asset information
    getTokenInfo: function(o){
        var me   = this;
        if(o.asset=='BTC'){
            var price_usd = me.main.getCurrencyPrice('bitcoin','usd'),
                values = Ext.apply(o.estimated_value,{
                usd: price_usd
            });
            me.updateData({
                asset: 'BTC',
                quantity: o.quantity,
                supply: '21000000.00000000',
                website: 'http://bitcoin.org',
                divisible: true,
                locked: true,
                description: 'Bitcoin is digital money',
                estimated_value: values
            });
        } else {
            // Set loading mask on panel to indicate we are loading 
            var successCb = function(o){
                var desc = o.description;
                if(me.main.isUrl(desc))
                    o.website = desc;
                if(o.asset=='XCP'){
                    o.website = 'https://counterparty.io';
                    o.locked = true;
                    o.description = 'Counterparty extends Bitcoin in new and powerful ways.';                       
                }
                me.updateData(Ext.apply(o,{ 
                    quantity: data.quantity,
                    asset: data.asset
                }));
                me.setMasked(false);
                // Detect any .json urls and request the extra data
                if(/.json$/.test(desc))
                    me.getEnhancedAssetInfo(desc);
            }
            wallet.getTokenInfo(data.asset, successCb);
        }
    },

  };
  
  //function ------------------------------------------------------------
  
  // Get element id 
  function $id(id) {
    return document.querySelector(id);
  }

  //AJAX ----------------------------------------------------------

  
