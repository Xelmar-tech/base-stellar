#![no_std]

#[cfg(test)]
extern crate std;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token::TokenClient, Address, Bytes, Env,
    String,
};
use stellar_axelar_gateway::executable::{
    validate_message, AxelarExecutable, AxelarExecutableInterface, CustomAxelarExecutable,
};

#[derive(Clone)]
#[contracttype]
pub enum VaultData {
    Gateway,
    SourceAddress,
}

#[contract]
#[derive(AxelarExecutable)]
pub struct Vault {}

#[contracterror]
#[derive(Clone, Debug, PartialEq)]
pub enum VaultError {
    NotApproved = 0,
    InvalidSourceChain = 1,
    InvalidSourceAddress = 2,
    TransferFailed = 3,
    InvalidPayload = 4,
}

impl Vault {
    fn get_gateway(e: &Env) -> Address {
        e.storage()
            .instance()
            .get::<_, Address>(&VaultData::Gateway)
            .unwrap()
    }

    fn get_source_address(e: &Env) -> String {
        e.storage()
            .instance()
            .get::<_, String>(&VaultData::SourceAddress)
            .unwrap()
    }

    fn execute_transfer(e: &Env, token_address: Address, recipient: Address, amount: i128) {
        let token_client = TokenClient::new(e, &token_address);
        token_client.transfer(&e.current_contract_address(), &recipient, &amount);
    }

    fn parse_payload(payload: &Bytes) -> Result<(Address, Address, i128), VaultError> {
        let token_len = payload.get(0).unwrap() as u32;
        let token = Address::from_string_bytes(&payload.slice(1..1 + token_len));

        let recip_offset = 1 + token_len;
        let recip_len = payload.get(recip_offset).unwrap() as u32;
        let recipient = Address::from_string_bytes(
            &payload.slice(recip_offset + 1..recip_offset + 1 + recip_len),
        );

        let amount_offset = recip_offset + 1 + recip_len;
        let mut amount: i128 = 0;
        for i in amount_offset..payload.len() {
            amount = (amount << 8) | (payload.get(i).unwrap() as i128);
        }
        Ok((token, recipient, amount))
    }
}

#[contractimpl]
impl Vault {
    pub fn init(e: &Env, gateway: Address, source_address: String) {
        if e.storage().instance().has(&VaultData::Gateway) {
            panic!("already initialized");
        }
        e.storage().instance().set(&VaultData::Gateway, &gateway);
        e.storage()
            .instance()
            .set(&VaultData::SourceAddress, &source_address);
    }
}

impl CustomAxelarExecutable for Vault {
    type Error = VaultError;

    fn __gateway(e: &Env) -> Address {
        Vault::get_gateway(e)
    }

    fn __execute(
        e: &Env,
        source_chain: String,
        message_id: String,
        source_address: String,
        payload: Bytes,
    ) -> Result<(), Self::Error> {
        validate_message::<Vault>(&e, &source_chain, &message_id, &source_address, &payload)
            .map_err(|_| VaultError::NotApproved)?;

        let base_str = String::from_str(e, "base-sepolia");
        if source_chain != base_str {
            return Err(VaultError::InvalidSourceChain);
        }

        let expected = Self::get_source_address(e);
        // Case-insensitive compare
        let e_bytes = expected.to_bytes();
        let s_bytes = source_address.to_bytes();
        if e_bytes.len() != s_bytes.len() {
            return Err(VaultError::InvalidSourceAddress);
        }
        for i in 0..e_bytes.len() {
            let e_b = e_bytes.get(i).unwrap_or(0);
            let s_b = s_bytes.get(i).unwrap_or(0);
            let e_lower = if e_b >= 65 && e_b <= 90 {
                e_b + 32
            } else {
                e_b
            };
            let s_lower = if s_b >= 65 && s_b <= 90 {
                s_b + 32
            } else {
                s_b
            };
            if e_lower != s_lower {
                return Err(VaultError::InvalidSourceAddress);
            }
        }

        let (token, recipient, amount) = Self::parse_payload(&payload)?;
        Self::execute_transfer(e, token, recipient, amount);
        Ok(())
    }
}
