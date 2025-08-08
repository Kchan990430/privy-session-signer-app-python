import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { PrivyProvider } from "@privy-io/react-auth";
import { baseSepolia, base, mainnet } from "viem/chains";
import "../lib/acp-fetch";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <link
          rel="preload"
          href="/fonts/AdelleSans-Regular.woff"
          as="font"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/AdelleSans-Regular.woff2"
          as="font"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/AdelleSans-Semibold.woff"
          as="font"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/AdelleSans-Semibold.woff2"
          as="font"
          crossOrigin=""
        />

        <link rel="icon" href="/favicons/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicons/apple-touch-icon.png" />
        <link rel="manifest" href="/favicons/manifest.json" />

        <title>Privy Auth Starter</title>
        <meta name="description" content="Privy Auth Starter" />
      </Head>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
        config={{
          // Configure social login methods
          loginMethods: [
            'email',
            'wallet',
            'google',
          ],
          
          // Configure appearance
          appearance: {
            theme: 'light',
            accentColor: '#676FFF'
          },
          
          // Configure embedded wallets
          embeddedWallets: {
            createOnLogin: "users-without-wallets",
            requireUserPasswordOnCreate: false,
          },
          
          // Configure default chain for embedded wallets
          defaultChain: baseSepolia,
          
          // Configure supported chains
          supportedChains: [baseSepolia, mainnet, base],
        }}
      >
        <Component {...pageProps} />
      </PrivyProvider>
    </>
  );
}

export default MyApp;
