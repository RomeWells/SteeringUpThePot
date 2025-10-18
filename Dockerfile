# Use official Node.js image
FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Copy package.json & package-lock.json first
COPY package*.json ./

# Install dependencies (wrtc will install fine on Linux in Cloud Run)
RUN npm install --production

# Copy the rest of the files
COPY . .

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
