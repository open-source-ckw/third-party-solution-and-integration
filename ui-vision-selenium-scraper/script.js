async function getHelloGraph() {
  const res = await fetch("https://bfw-nestjs-microservice-api.thatsend.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query HelloGraph { HelloGraph }`
    })
  });

  const response = await res.json();
  const data = response.data.HelloGraph;
  return data;
}

// example usage:
let result = await getHelloGraph().then(console.log).catch(console.error);
return result;
