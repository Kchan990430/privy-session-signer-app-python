// Gas sponsorship configuration for Base Sepolia
export const gasSponsorshipConfig = {
  // Use separate endpoints for paymaster and bundler
  // Pimlico v1 is for bundler, v2 is for paymaster
  paymasterUrl: "https://api.pimlico.io/v2/base-sepolia/rpc?apikey=pim_BiC9zQWYZd7LuGbAvsoJn8",
  bundlerUrl: "https://api.pimlico.io/v1/base-sepolia/rpc?apikey=pim_BiC9zQWYZd7LuGbAvsoJn8",
};