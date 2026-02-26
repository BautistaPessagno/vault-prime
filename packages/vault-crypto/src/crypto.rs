use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};

use aes_gcm::{
    Aes256Gcm,
    Key,
    Nonce,
    aead::{Aead, AeadCore, KeyInit},
};
use hkdf::Hkdf;
use sha2::Sha256;

// ----------------------------- Argon2 hash ------------------------------------------------

pub fn hash(password: &str, salt: SaltString) -> Result<String, argon2::password_hash::Error> {
    let params = argon2::Params::new(65536, 3, 4, Some(32));
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params?);
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)?
        .to_string();

    Ok(password_hash)
}

pub fn master_password_hash(password: &str) -> Result<String, argon2::password_hash::Error> {
    let params = argon2::Params::new(65536, 3, 4, Some(32));
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params?);
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)?
        .to_string();

    Ok(password_hash)
}

pub fn verify(password: &str, password_hash: &str) -> Result<bool, argon2::password_hash::Error> {
    let argon2 = Argon2::default();
    let parsed_hash = PasswordHash::new(password_hash)?;
    let password_verify = argon2
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok();
    Ok(password_verify)
}

// ----------------------------- derivation key ------------------------------------------------

pub fn derive_key(payload: &str, salt: &str) -> Result<[u8; 32], hkdf::InvalidLength> {
    let ikm = payload.as_bytes();
    let salt = salt.as_bytes();
    let info = "vault-prime-derivation".as_bytes();

    let hk = Hkdf::<Sha256>::new(Some(&salt), &ikm);
    let mut okm = [0u8; 32];
    hk.expand(&info, &mut okm)?;
    Ok(okm)
}

// ----------------------------- aes-256-gcm key ------------------------------------------------

pub fn generate_encryption_key() -> Result<Key<Aes256Gcm>, aes_gcm::Error> {
    let key = Aes256Gcm::generate_key(&mut OsRng);
    Ok(key)
}

pub fn generate_nonce() -> Result<Nonce<<Aes256Gcm as AeadCore>::NonceSize>, aes_gcm::Error> {
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    Ok(nonce)
}

pub fn encrypt(
    key: &Key<Aes256Gcm>,
    nonce: &Nonce<<Aes256Gcm as AeadCore>::NonceSize>,
    plaintext: &[u8],
) -> Result<Vec<u8>, aes_gcm::Error> {
    let cipher = Aes256Gcm::new(key);
    let ciphertext = cipher.encrypt(nonce, plaintext)?;
    Ok(ciphertext)
}

pub fn decrypt(
    key: &Key<Aes256Gcm>,
    nonce: &Nonce<<Aes256Gcm as AeadCore>::NonceSize>,
    ciphertext: &[u8],
) -> Result<Vec<u8>, aes_gcm::Error> {
    let cipher = Aes256Gcm::new(key);
    let plaintext = cipher.decrypt(nonce, ciphertext)?;
    Ok(plaintext)
}
