import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
const typeDefs = `#graphql
    # Lyrics internally should always be a JSON string
    type Song {
        name: String!
        artists: [String!]!
        duration: Float!
        id: String!
        lyrics: String
        url: String
    }

    type Query {
        getSong(name: String!, artists: [String!]!, duration: Float!, id: String!): Song!
    }

    type Mutation {
        requestKaraoke(name: String!, artists: [String!]!, duration: Float!, id: String!): Song!
        addKaraoke(name: String!, artists: [String!]!, duration: Float!, id: String!, lyrics: String!, url: String!): Song!
    }

    type Subscription {
        requestedKaraoke: Song!
        # @aws_subscribe(mutations: ["requestKaraoke"])
        addedKaraoke(name: String!, artists: [String!]!, duration: Float!, id: String!): Song!
        # @aws_subscribe(mutations: ["addKaraoke"])
    }
`;
const resolvers = {
    Query: {
        getSong: (_, { name, artists, duration, id }) => {
            return {
                name: name,
                artists: artists,
                duration: duration,
                id: id,
            };
        },
    }
};
const server = new ApolloServer({
    typeDefs,
    resolvers,
});
const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
});
console.log(`Server listening at: ${url}`);
