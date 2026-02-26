use argon2::password_hash::SaltString;
use vault_crypto::{
    decrypt, derive_key, encrypt, generate_encryption_key, generate_nonce, hash,
    master_password_hash, verify,
};

fn main() {
    //prueba de argon2
    let password = "Bauti2004";
    let mail = "bau.pessa@gmail.com";
    println!("Password: {} \n Mail: {}", password, mail);

    let salt = SaltString::encode_b64(mail.as_bytes()).unwrap();
    let master_key = hash(password, salt).unwrap();

    println!("master_key: {}", master_key);

    let passwords = ["123456", "bautista", "Bauti2004", "12345678", "askncsn"];

    for password in passwords {
        let password_verify = verify(password, &master_key).unwrap();
        println!("Password {} {}", password, password_verify);
    }

    let master_password_hash = master_password_hash(&master_key).unwrap();
    println!("Master Password Hash: {}", master_password_hash);

    // prueba de derivar la clave
    let derived_key = derive_key(master_key.as_str(), password).unwrap();

    println!("Derived Key: {}", hex::encode(derived_key));

    //prueba de aes-256-gcm
    let key = generate_encryption_key().unwrap();
    let nonce = generate_nonce().unwrap();

    println!("Key: {} \nNonce: {}", hex::encode(key), hex::encode(nonce));

    let text = "Hello, world!";

    println!("Text: {}", text);

    let ciphertext = encrypt(&key, &nonce, text.as_bytes()).unwrap();

    println!("Ciphertext: {}", hex::encode(&ciphertext));

    let plaintext = decrypt(&key, &nonce, &ciphertext).unwrap();

    assert_eq!(text.as_bytes(), &plaintext[..]);

    println!("Plaintext: {}", String::from_utf8(plaintext).unwrap());
}
