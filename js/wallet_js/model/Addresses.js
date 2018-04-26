/*
 * Addresses.js - Model
 */
  adresses = {
      fields: [
          {name: 'id',      type: 'string'}, // address id
          {name: 'prefix',  type: 'string'}, // HD Wallet Prefix
          {name: 'index',   type: 'int'},    // Wallet Address index
          {name: 'network', type: 'int'},    // Network (1=Mainnet, 2=Testnet)
          {name: 'address', type: 'string'}, // Address
          {name: 'label',   type: 'label'}   // Address Label
      ],
      idProperty: 'id',
      proxy: {
          type: 'localstorage',
          id: 'Addresses',
          idProperty: 'id'
      }        
  }
