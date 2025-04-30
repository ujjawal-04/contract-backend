// src/config/ssl.ts
export function getMongoConnectionOptions() {
    // Fixed SSL options: removed tlsInsecure because it conflicts with tlsAllowInvalidCertificates
    return {
      ssl: true,
      tls: true,
      // Only include one of these, not both:
      // tlsInsecure: false,           // Remove this line
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
      directConnection: false,
      retryWrites: true,
      family: 4  // Force IPv4
    };
  }
  
  // Function to modify MongoDB connection string
  export function getSafeMongoURI(originalURI: string): string {
    if (!originalURI) {
      throw new Error('MongoDB URI is not provided');
    }
  
    try {
      const uri = new URL(originalURI);
      
      // Ensure these parameters are set
      uri.searchParams.set('ssl', 'true');
      uri.searchParams.set('retryWrites', 'true');
      uri.searchParams.set('w', 'majority');
      
      return uri.toString();
    } catch (error) {
      console.error('Error parsing MongoDB URI:', error);
      // Return original if parsing fails
      return originalURI;
    }
  }