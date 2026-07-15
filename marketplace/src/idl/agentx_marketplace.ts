/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/agentx_marketplace.json`.
 */
export type AgentxMarketplace = {
  "address": "Ccgw6kq1PQfE5zx6EpFixNEafvRMu4udzZuNWmvzTqHA",
  "metadata": {
    "name": "agentxMarketplace",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Solana access registry and settlement program for AgentX"
  },
  "instructions": [
    {
      "name": "consumeAccess",
      "discriminator": [
        78,
        71,
        77,
        216,
        11,
        194,
        243,
        62
      ],
      "accounts": [
        {
          "name": "marketplace",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  112,
                  108,
                  97,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "listing",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "listing.creator",
                "account": "agentListing"
              },
              {
                "kind": "account",
                "path": "listing.agent_id",
                "account": "agentListing"
              }
            ]
          }
        },
        {
          "name": "access",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  99,
                  101,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "listing"
              },
              {
                "kind": "account",
                "path": "access.owner",
                "account": "accessGrant"
              }
            ]
          }
        },
        {
          "name": "executor",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initializeMarketplace",
      "discriminator": [
        47,
        81,
        64,
        0,
        96,
        56,
        105,
        7
      ],
      "accounts": [
        {
          "name": "marketplace",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  112,
                  108,
                  97,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBasisPoints",
          "type": "u16"
        }
      ]
    },
    {
      "name": "purchaseAccess",
      "discriminator": [
        191,
        249,
        111,
        210,
        163,
        248,
        87,
        242
      ],
      "accounts": [
        {
          "name": "marketplace",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  112,
                  108,
                  97,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "listing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "listing.creator",
                "account": "agentListing"
              },
              {
                "kind": "account",
                "path": "listing.agent_id",
                "account": "agentListing"
              }
            ]
          }
        },
        {
          "name": "access",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  99,
                  101,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "listing"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "creator",
          "writable": true,
          "relations": [
            "listing"
          ]
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "registerAgent",
      "discriminator": [
        135,
        157,
        66,
        195,
        2,
        113,
        175,
        30
      ],
      "accounts": [
        {
          "name": "marketplace",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  112,
                  108,
                  97,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "listing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "agentId"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "metadataHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "priceLamports",
          "type": "u64"
        },
        {
          "name": "pricingModel",
          "type": {
            "defined": {
              "name": "pricingModel"
            }
          }
        }
      ]
    },
    {
      "name": "updateAgent",
      "discriminator": [
        85,
        2,
        178,
        9,
        119,
        139,
        102,
        164
      ],
      "accounts": [
        {
          "name": "listing",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "listing.creator",
                "account": "agentListing"
              },
              {
                "kind": "account",
                "path": "listing.agent_id",
                "account": "agentListing"
              }
            ]
          }
        },
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "listing"
          ]
        }
      ],
      "args": [
        {
          "name": "metadataHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "priceLamports",
          "type": "u64"
        },
        {
          "name": "pricingModel",
          "type": {
            "defined": {
              "name": "pricingModel"
            }
          }
        },
        {
          "name": "active",
          "type": "bool"
        }
      ]
    },
    {
      "name": "updateMarketplace",
      "discriminator": [
        72,
        12,
        22,
        71,
        86,
        113,
        79,
        167
      ],
      "accounts": [
        {
          "name": "marketplace",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  112,
                  108,
                  97,
                  99,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "marketplace"
          ]
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newTreasury",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newFeeBasisPoints",
          "type": {
            "option": "u16"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "accessGrant",
      "discriminator": [
        167,
        55,
        184,
        237,
        74,
        242,
        0,
        109
      ]
    },
    {
      "name": "agentListing",
      "discriminator": [
        224,
        156,
        61,
        213,
        111,
        100,
        43,
        56
      ]
    },
    {
      "name": "marketplaceConfig",
      "discriminator": [
        169,
        22,
        247,
        131,
        182,
        200,
        81,
        124
      ]
    }
  ],
  "events": [
    {
      "name": "accessConsumed",
      "discriminator": [
        169,
        211,
        211,
        31,
        252,
        108,
        244,
        56
      ]
    },
    {
      "name": "accessPurchased",
      "discriminator": [
        181,
        7,
        225,
        172,
        63,
        248,
        25,
        38
      ]
    },
    {
      "name": "agentRegistered",
      "discriminator": [
        191,
        78,
        217,
        54,
        232,
        100,
        189,
        85
      ]
    },
    {
      "name": "agentUpdated",
      "discriminator": [
        210,
        179,
        162,
        250,
        123,
        250,
        210,
        166
      ]
    },
    {
      "name": "marketplaceInitialized",
      "discriminator": [
        22,
        167,
        42,
        34,
        172,
        55,
        155,
        14
      ]
    },
    {
      "name": "marketplaceUpdated",
      "discriminator": [
        76,
        144,
        13,
        244,
        21,
        28,
        23,
        203
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "feeTooHigh",
      "msg": "Marketplace fee cannot exceed 10%"
    },
    {
      "code": 6001,
      "name": "invalidAddress",
      "msg": "The supplied address is invalid"
    },
    {
      "code": 6002,
      "name": "unauthorizedAuthority",
      "msg": "Only the marketplace authority may perform this action"
    },
    {
      "code": 6003,
      "name": "unauthorizedCreator",
      "msg": "Only the listing creator may perform this action"
    },
    {
      "code": 6004,
      "name": "invalidMetadata",
      "msg": "The listing metadata hash cannot be empty"
    },
    {
      "code": 6005,
      "name": "invalidFreePrice",
      "msg": "Free listings must have a zero price"
    },
    {
      "code": 6006,
      "name": "invalidPaidPrice",
      "msg": "Paid listings must have a non-zero price"
    },
    {
      "code": 6007,
      "name": "listingPaused",
      "msg": "This listing is paused"
    },
    {
      "code": 6008,
      "name": "creatorCannotBeTreasury",
      "msg": "The creator and marketplace treasury must be different accounts"
    },
    {
      "code": 6009,
      "name": "invalidTreasury",
      "msg": "The marketplace treasury account is invalid"
    },
    {
      "code": 6010,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6011,
      "name": "accessAlreadyPermanent",
      "msg": "Permanent access has already been purchased"
    },
    {
      "code": 6012,
      "name": "invalidAccessOwner",
      "msg": "The access owner is invalid"
    },
    {
      "code": 6013,
      "name": "invalidListing",
      "msg": "The access grant does not belong to this listing"
    },
    {
      "code": 6014,
      "name": "unauthorizedExecutor",
      "msg": "The executor cannot consume this access grant"
    },
    {
      "code": 6015,
      "name": "accessDenied",
      "msg": "Access is not active"
    },
    {
      "code": 6016,
      "name": "subscriptionExpired",
      "msg": "The subscription has expired"
    },
    {
      "code": 6017,
      "name": "noRunCredits",
      "msg": "No run credits remain"
    }
  ],
  "types": [
    {
      "name": "accessConsumed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "listing",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "executor",
            "type": "pubkey"
          },
          {
            "name": "usageCount",
            "type": "u64"
          },
          {
            "name": "remainingRuns",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "accessGrant",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "listing",
            "type": "pubkey"
          },
          {
            "name": "permanent",
            "type": "bool"
          },
          {
            "name": "expiresAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "remainingRuns",
            "type": "u32"
          },
          {
            "name": "usageCount",
            "type": "u64"
          },
          {
            "name": "lastPurchaseAt",
            "type": "i64"
          },
          {
            "name": "lastUsedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "accessPurchased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "listing",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "pricingModel",
            "type": {
              "defined": {
                "name": "pricingModel"
              }
            }
          },
          {
            "name": "priceLamports",
            "type": "u64"
          },
          {
            "name": "feeLamports",
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "remainingRuns",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "agentListing",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "metadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "priceLamports",
            "type": "u64"
          },
          {
            "name": "pricingModel",
            "type": {
              "defined": {
                "name": "pricingModel"
              }
            }
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "totalPurchases",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "agentRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "listing",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "agentId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "metadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "priceLamports",
            "type": "u64"
          },
          {
            "name": "pricingModel",
            "type": {
              "defined": {
                "name": "pricingModel"
              }
            }
          }
        ]
      }
    },
    {
      "name": "agentUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "listing",
            "type": "pubkey"
          },
          {
            "name": "metadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "priceLamports",
            "type": "u64"
          },
          {
            "name": "pricingModel",
            "type": {
              "defined": {
                "name": "pricingModel"
              }
            }
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "marketplaceConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "feeBasisPoints",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "marketplaceInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "feeBasisPoints",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "marketplaceUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "feeBasisPoints",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "pricingModel",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "free"
          },
          {
            "name": "oneTime"
          },
          {
            "name": "subscription"
          },
          {
            "name": "payPerUse"
          }
        ]
      }
    }
  ]
};
