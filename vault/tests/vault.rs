#![cfg(test)]

extern crate std;

use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};
use stellar_axelar_gateway::testutils::setup_gateway;
use stellar_axelar_std::String as AxelarString;

use vault::{Vault, VaultClient};

#[test]
fn test_init() {
    let env = Env::default();
    env.mock_all_auths();

    let gateway_address = Address::generate(&env);
    let source_address = AxelarString::from_str(&env, "0x1234567890abcdef");

    let vault_id = env.register(Vault {}, ());
    let vault_client = VaultClient::new(&env, &vault_id);

    vault_client.init(&gateway_address, &source_address);
}

#[test]
fn test_init_with_axelar_gateway() {
    let env = Env::default();
    env.mock_all_auths();

    let (_signer_set, gateway_client) = setup_gateway(&env, 0, 1);
    let gateway_address = gateway_client.address;

    let vault_id = env.register(Vault {}, ());
    let vault_client = VaultClient::new(&env, &vault_id);

    let source_address = AxelarString::from_str(&env, "0xE7fc2C2ccea91c5Ce55a6819CDEe315AA9BA12e6");

    vault_client.init(&gateway_address, &source_address);
}
