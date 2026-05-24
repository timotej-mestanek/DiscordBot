import { createShopLayout } from "./layout";



const channelId = 1507479631266189472;


const renderShop = async(channelId:number) =>{
    const elements = [
        {
            name:"Premena 1 000 000 DCC za 1000 STC",
            price:1000000,
        },
        {
            name:"Premena 10 000 000 DCC za 10 250STC",
            price:10000000,
        }
    ]
    const embed = await createShopLayout(elements);
    // RENDER TO CHANNEL
}