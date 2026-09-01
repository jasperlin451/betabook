const worker = {
  fetch() {
    return new Response("Test worker");
  },
};

export default worker;
