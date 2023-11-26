import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws'
import { PubSub, withFilter } from 'graphql-subscriptions'

const PORT = 4000;

const pubsub = new PubSub();

const typeDefs = `#graphql
    # Lyrics internally should always be a JSON string
    type Song {
        name: String
        artists: [String!]
        duration: Float
        id: String!
        lyrics: String
        url: String
    }

    type Query {
        getSong(id: String!): Song!
    }

    type Mutation {
        requestKaraoke(name: String!, artists: [String!]!, duration: Float!, id: String!): Song!
        addKaraoke(id: String!, lyrics: String!, url: String!): Song!
    }

    type Subscription {
        requestedKaraoke: Song!
        # @aws_subscribe(mutations: ["requestKaraoke"])
        addedKaraoke(id: String!): Song!
        # @aws_subscribe(mutations: ["addKaraoke"])
    }
`;

const resolvers = {
    Query: {
        getSong: (_, {id}: {id: string}) => {
            return {
                id: id,
            };
        },
    },
    Mutation: {
        requestKaraoke: (_, {name, artists, duration, id}: {name: string, artists: Array<string>, duration: number, id: string}) => {
            pubsub.publish("KARAOKE_REQUESTED", {
                requestedKaraoke: {
                    name,
                    artists,
                    duration,
                    id
                }
            });
            return {
                name: name, 
                artists: artists, 
                duration: duration, 
                id: id,
            };
        },
        addKaraoke: (_, {id, lyrics, url}: {id: string, lyrics: string, url: string}) => {
            pubsub.publish("KARAOKE_ADDED", {
                addedKaraoke: {
                    id,
                    lyrics,
                    url
                }
            })
            return {
                id: id,
                lyrics: lyrics,
                url: url
            };
        }
    },
    Subscription: {
        requestedKaraoke: {
            subscribe: () => pubsub.asyncIterator(["KARAOKE_REQUESTED"])
        },
        addedKaraoke: {
            subscribe: withFilter(
                () => pubsub.asyncIterator("KARAOKE_ADDED"),
                (payload, variables) => {
                    return (
                        payload.addedKaraoke.id === variables.id
                    )
                }
            )
        }
    }
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express();
const httpServer = createServer(app);

const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql'
});

const serverCleanup = useServer({ schema }, wsServer);

const server = new ApolloServer({
    schema,
    plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),

        {
            async serverWillStart() {
                return {
                    async drainServer() {
                        await serverCleanup.dispose();
                    }
                }
            }
        }
    ]
});

await server.start();
app.use("/graphql", cors<cors.CorsRequest>(), express.json(), expressMiddleware(server));

httpServer.listen(PORT, () => {
    console.log(`Server listening on port http://localhost:${PORT}/graphql`)
});
