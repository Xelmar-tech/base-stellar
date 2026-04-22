#![no_std]

#[cfg(test)]
extern crate std;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token::TokenClient, Address, Bytes, Env,
    String,
};
use stellar_axelar_gateway::executable::{
    AxelarExecutable, AxelarExecutableInterface, CustomAxelarExecutable,
};

// ── Storage ──────────────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub enum VaultData {
    Gateway,
    SourceChain,
    SourceAddress,
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
#[derive(AxelarExecutable)]
pub struct Vault {}

// ── Errors ───────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Clone, Debug, PartialEq)]
pub enum VaultError {
    NotApproved  = 1,
    InvalidSourceChain = 2,
    InvalidSourceAddress = 3,
    InvalidPayload = 4,
    TransferFailed = 5,
}

// ── Internal helpers ─────────────────────────────────────────────────────────

impl Vault {
    fn get_gateway(e: &Env) -> Address {
        e.storage()
            .instance()
            .get::<_, Address>(&VaultData::Gateway)
            .unwrap()
    }

    fn get_source_chain(e: &Env) -> String {
        e.storage()
            .instance()
            .get::<_, String>(&VaultData::SourceChain)
            .unwrap()
    }

    fn get_source_address(e: &Env) -> String {
        e.storage()
            .instance()
            .get::<_, String>(&VaultData::SourceAddress)
            .unwrap()
    }

    /// Decode encodePacked payload:
    /// [1 byte token_len][token bytes][1 byte recip_len][recip bytes][16 bytes amount]
    fn parse_payload(payload: &Bytes) -> Result<(Address, Address, i128), VaultError> {
        if payload.len() < 3 {
            return Err(VaultError::InvalidPayload);
        }

        let token_len = payload.get(0).ok_or(VaultError::InvalidPayload)? as u32;
        if 1 + token_len >= payload.len() {
            return Err(VaultError::InvalidPayload);
        }
        let token_bytes = payload.slice(1..1 + token_len);
        let token = Address::from_string_bytes(&token_bytes);  // &Bytes directly ✅

        let recip_offset = 1 + token_len;
        let recip_len = payload.get(recip_offset).ok_or(VaultError::InvalidPayload)? as u32;
        if recip_offset + 1 + recip_len > payload.len() {
            return Err(VaultError::InvalidPayload);
        }
        let recip_bytes = payload.slice(recip_offset + 1..recip_offset + 1 + recip_len);
        let recipient = Address::from_string_bytes(&recip_bytes);  // &Bytes directly ✅

        let amount_offset = recip_offset + 1 + recip_len;
        if amount_offset >= payload.len() {
            return Err(VaultError::InvalidPayload);
        }
        let mut amount: i128 = 0;
        for i in amount_offset..payload.len() {
            let byte = payload.get(i).ok_or(VaultError::InvalidPayload)?;
            amount = (amount << 8) | (byte as i128);
        }

        Ok((token, recipient, amount))
    }

    fn execute_transfer(e: &Env, token: Address, recipient: Address, amount: i128) {
        TokenClient::new(e, &token).transfer(
            &e.current_contract_address(),
            &recipient,
            &amount,
        );
    }
}

// ── Constructor ───────────────────────────────────────────────────────────────

#[contractimpl]
impl Vault {
    /// One-time initializer. Stores gateway, expected source chain, and source address.
    /// source_address should be the StellarGateway.sol address e.g. "0x2BC0..."
    pub fn init(e: &Env, gateway: Address, source_chain: String, source_address: String) {
        if e.storage().instance().has(&VaultData::Gateway) {
            panic!("already initialized");
        }
        e.storage().instance().set(&VaultData::Gateway, &gateway);
        e.storage().instance().set(&VaultData::SourceChain, &source_chain);
        e.storage().instance().set(&VaultData::SourceAddress, &source_address);
    }
}

// ── Axelar execution ──────────────────────────────────────────────────────────

impl CustomAxelarExecutable for Vault {
    type Error = VaultError;

    fn __gateway(e: &Env) -> Address {
        Vault::get_gateway(e)
    }

    /// NOTE: validate_message is already called by the AxelarExecutable macro
    /// before __execute is invoked. Do NOT call it again here.
    fn __execute(
        e: &Env,
        source_chain: String,
        _message_id: String,
        source_address: String,
        payload: Bytes,
    ) -> Result<(), Self::Error> {
        // Validate source chain
        if source_chain != Self::get_source_chain(e) {
            return Err(VaultError::InvalidSourceChain);
        }

        // Validate source address (case-insensitive for EVM hex)
        if source_address != Self::get_source_address(e) {
            return Err(VaultError::InvalidSourceAddress);
        }

        // Decode payload and execute transfer
        let (token, recipient, amount) = Self::parse_payload(&payload)?;
        Self::execute_transfer(e, token, recipient, amount);

        Ok(())
    }
}