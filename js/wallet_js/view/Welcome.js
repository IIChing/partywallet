  function createWallet(phrase){
    //if(loadingWallet)
    // return;
    // loadingWallet = false;
    //spiner.show();
    // Define callback to process response from generateWallet()
    var cb = function(p){
        // If a passphrase was specified, then just load the wallet
        
        if(phrase ){
           // loadingWallet = false;
            //me.main.showMainView();
            wallet.redirect('main')
            console.log('main vue')
        } else { 
          wallet.showPassphraseView(p); 
        }
        //me.spinner.hide();
      }
    // Defer by 1/2 a second to allow screen to update and show spinner 
    wallet.generateWallet(phrase, cb);
    /*
    setTimeout(function(){
       wallet.generateWallet(phrase, cb);
    },500)
    */
  }
  // Handle setting up existing wallet using passphrase
  function existingWallet(e){
    // Define callback to process response from promptWalletPassphrase()
    var cb = function(phrase){
       createWallet(phrase);
    }
    wallet.promptWalletPassphrase(e,cb);
    //me.main.promptWalletPassphrase(cb); 
  }

  function init(html,token){        
    "use strict";
    let button; 
    
    if( button = $id('#yes')){
      button.addEventListener("click", function(e){
        existingWallet(e);
      });
    }
    let selectList = html.querySelector('#select-token'), 
        //token = store.get("Balances"),
        form = html.querySelectorAll('.sendForm');
      
           // Here is your next action
          var a = [];
          for (let i = 0; i < token.length; i++) {
              let option = document.createElement("option"),
                  o = store.get(token[i]);
              a.push(o);
              option.value = o.asset;
              option.text = o.asset;
              selectList.appendChild(option);

              if(a[0] && i == token.length-1)
                data.tools.updateBalance(html, a[0], a[0].asset); 
            
          }
        
          // get token balance on select 
          selectList.onchange = function(){
            let me = this,
                s; 
            for( i =0; i<a.length; i++){
              if(a[i].asset == me.value)
                s = a[i];
          }
          data.tools.updateBalance(html, s, me.value); 
       }

    // transaction fee
    if(button = html.querySelectorAll('[data-fee]')){
      for(var i=0; i < button.length; ++i){
        //console.log(button[i]);
        button[i].addEventListener("click", function(e){
          return data.tools.setFee(Number(e.target.value));
        },false); 
      }
    }

    //logout / Clear Data
    if(button = $id('#logout')){ 
      let atbox = $id('.alert');
      button.onclick=function(e){
        console.log('GEDRUECKT');
        //let yes = $id('.yes');
        //let no = $id('.no');
          wallet.alertbox({
          title: 'Logout',
          text: 'Are you sure?',
          atbox: atbox,
          confirms: function(){
             localStorage.clear()
             location.reload();
          },
          cancel: function (){      
            atbox.className += ' hidden';     
          },
          btn : [this.yes, this.no]
        },html); 
      }       
    } 

    // validate form
    if(button = html.querySelector('#send')){
      button.addEventListener("click", function(e){
        return data.tools.validate(e);
      });
    }

    if(button = html.querySelectorAll('.sent')[0]){
      button.addEventListener("click", function(e){
      // data.tools.sendForm(form); 
      }); 
    }

    initAccordion(document.getElementById('accordion')); 
  }


