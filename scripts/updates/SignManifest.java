import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.io.*;

/** Reads the existing external signing properties; never exports the private key. */
class SignManifest {
    public static void main(String[] args) throws Exception {
        Map<String,String> flags = new HashMap<>();
        for (int i = 0; i < args.length; i += 2) flags.put(args[i], args[i + 1]);
        Path propertiesPath = Path.of(Objects.requireNonNull(flags.get("--properties"))).toAbsolutePath();
        Properties properties = new Properties();
        try (InputStream stream = Files.newInputStream(propertiesPath)) { properties.load(stream); }
        char[] storePassword = properties.getProperty("storePassword").toCharArray();
        char[] keyPassword = properties.getProperty("keyPassword").toCharArray();
        try {
            Path storePath = Path.of(properties.getProperty("storeFile"));
            if (!storePath.isAbsolute()) storePath = propertiesPath.getParent().resolve(storePath);
            KeyStore store = KeyStore.getInstance("PKCS12");
            try (InputStream input = Files.newInputStream(storePath)) { store.load(input, storePassword); }
            String alias = properties.getProperty("keyAlias");
            var certificate = store.getCertificate(alias);
            PublicKey publicKey = certificate.getPublicKey();
            if (!"RSA".equals(publicKey.getAlgorithm())) throw new IllegalArgumentException("Update signing requires the release RSA key");
            if (flags.containsKey("--public-out")) Files.write(Path.of(flags.get("--public-out")), publicKey.getEncoded());
            if (flags.containsKey("--certificate-out")) {
                String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(certificate.getEncoded()));
                Files.writeString(Path.of(flags.get("--certificate-out")), hash + "\n", java.nio.charset.StandardCharsets.UTF_8);
            }
            if (flags.containsKey("--input")) {
                byte[] bytes = Files.readAllBytes(Path.of(flags.get("--input")));
                if (bytes.length > 1_048_576) throw new IllegalArgumentException("Manifest exceeds limit");
                Signature signature = Signature.getInstance("SHA256withRSA");
                signature.initSign((PrivateKey) store.getKey(alias, keyPassword));
                signature.update(bytes);
                String envelope = "{\"payload\":\"" + Base64.getEncoder().encodeToString(bytes) + "\",\"signature\":\"" + Base64.getEncoder().encodeToString(signature.sign()) + "\"}\n";
                Files.writeString(Path.of(flags.get("--out")), envelope, java.nio.charset.StandardCharsets.UTF_8);
            }
        } finally { Arrays.fill(storePassword, '\0'); Arrays.fill(keyPassword, '\0'); }
    }
}
