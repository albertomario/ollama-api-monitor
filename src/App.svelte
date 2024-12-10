<script>
  import "./app.css";
  import "github-markdown-css/github-markdown-dark.css";
  import { 
    Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, 
    Button, Spinner, Badge, Modal, Input, Card 
  } from "flowbite-svelte";
  import { CheckCircleSolid, EyeSolid, ArchiveArrowDownSolid, SearchSolid } from 'flowbite-svelte-icons';
  import { stores } from "./stores.js";
  import JsonTree from "svelte-json-tree";
  import SvelteMarkdown from 'svelte-markdown';
  import dayjs from 'dayjs';
  import relativeTime from 'dayjs/plugin/relativeTime';
  import { onMount } from "svelte";

  dayjs.extend(relativeTime);

  const socket = new WebSocket("http://localhost:11434/api/ws");

  const MESSAGE_TYPES = {
    REQUEST: "request",
    RESPONSE: "response",
  };

  let isRequestModalOpen = false;
  let isResponseModalOpen = false;
  let selectedRequestId = null;
  let searchQuery = "";

  function getMessageType(data) {
    return data.response ? MESSAGE_TYPES.RESPONSE : MESSAGE_TYPES.REQUEST;
  }

  socket.onopen = () => {
    console.log("[open] Connection established");
  };


  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const messageType = getMessageType(data);

    stores.update((currentStore) => {
      if (messageType === MESSAGE_TYPES.REQUEST) {
        data.time = Math.round(Date.now() / 1000);
        currentStore.requests[data.request_id] = data;
      } else if (messageType === MESSAGE_TYPES.RESPONSE) {
        const requestId = data.request_id;
        const response = data.response;

        if (currentStore.responses[requestId]) {
          currentStore.responses[requestId].message.content += response.message.content;
        } else {
          currentStore.responses[requestId] = response;
        }

        if (response.total_duration) {
          currentStore.stats[requestId] = {
            eval_count: response.eval_count,
            eval_duration: response.eval_duration,
            load_duration: response.load_duration,
            prompt_eval_count: response.prompt_eval_count,
            prompt_eval_duration: response.prompt_eval_duration,
            total_duration: response.total_duration,
          };
        }
      }
      return currentStore;
    });
  };

  // Persisting stores in localStorage on mount
  onMount(() => {
    stores.subscribe((storeValue) => {
      localStorage.setItem("requests", JSON.stringify(storeValue.requests));
      localStorage.setItem("responses", JSON.stringify(storeValue.responses));
      localStorage.setItem("stats", JSON.stringify(storeValue.stats));
    });
  });

  function openRequestModal(requestId) {
    selectedRequestId = requestId;
    isRequestModalOpen = true;
  }

  function openResponseModal(requestId) {
    selectedRequestId = requestId;
    isResponseModalOpen = true;
  }

  function clearLocalStorage() {
    localStorage.removeItem("requests");
    localStorage.removeItem("responses");
    localStorage.removeItem("stats");
    stores.set({ requests: {}, responses: {}, stats: {} });
  }

  function retrieveRequests() {
    return Object.values($stores.requests)
          .filter(request => 
            request.request_id.toLowerCase().includes(searchQuery.toLowerCase()) || 
            ($stores.responses[request.request_id] && $stores.responses[request.request_id].message.content.toLowerCase().includes(searchQuery.toLowerCase()))
          )
          .sort((a, b) => b.time - a.time);
  }

</script>

<main>
  <div class="container mx-auto">
    <div class="mb-6">
      <div class="flex justify-between items-center">
        <div class="w-[500px]">
          <Input 
            id="search-input"
            bind:value={searchQuery} 
            placeholder="Search term in request and response"
          >
            <SearchSolid slot="left" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </Input>
        </div>
        <div>
          <Button color="light" on:click={clearLocalStorage}>Clear persistence</Button>
        </div>
      </div>

    </div>

    <Table class="rounded-xl border-2 border-gray-600 scale-[1]">
      <TableHead>
        <TableHeadCell class="text-center">Status</TableHeadCell>
        <TableHeadCell class="ps-12">Request</TableHeadCell>
        <TableHeadCell class="text-center">Response</TableHeadCell>
        <TableHeadCell></TableHeadCell>
      </TableHead>
      {#if retrieveRequests().length < 1}
        <TableBody tableBodyClass="divide-y">
          <TableBodyRow>
            <TableBodyCell tdClass="text-center p-8" colspan={4}>
              <Card class="mx-auto">
                <h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">No requests found</h5>
                <p class="font-normal text-gray-700 dark:text-gray-400 leading-tight">No requests received or search term not found.</p>
              </Card>
            </TableBodyCell>
          </TableBodyRow>
        </TableBody>
      {:else}
      <TableBody tableBodyClass="divide-y">
        {#each retrieveRequests() as request (request.request_id)}
          <TableBodyRow>
            <TableBodyCell tdClass="text-center w-[10%]">
              {#if !$stores.stats[request.request_id]}
                <Spinner color="yellow" size={8} />
              {:else}
                <CheckCircleSolid class="opacity-[.6] w-8 h-8 p-[2px] bg-red-100 border-red border-1 rounded-2xl m-auto" color="green" />
              {/if}
            </TableBodyCell>

            <TableBodyCell tdClass="w-[25%]">
              <Table striped={true} border={1} class="rounded-xl border-2 border-gray-500 scale-[.9]">
                <TableBody tableBodyClass="divide-y">
                  <TableBodyRow>
                    <TableBodyCell>Received at</TableBodyCell>
                    <TableBodyCell>{dayjs.unix(request.time).format("DD-MM-YYYY HH:mm:ss")}</TableBodyCell>
                  </TableBodyRow>
                  <TableBodyRow>
                    <TableBodyCell>RequestId</TableBodyCell>
                    <TableBodyCell>{request.request_id}</TableBodyCell>
                  </TableBodyRow>
                  <TableBodyRow>
                    <TableBodyCell>Model</TableBodyCell>
                    <TableBodyCell>{request.model}</TableBodyCell>
                  </TableBodyRow>
                  <TableBodyRow>
                    <TableBodyCell>Messages</TableBodyCell>
                    <TableBodyCell><Badge color="blue">{request.messages.length}</Badge></TableBodyCell>
                  </TableBodyRow>
                </TableBody>
              </Table>
            </TableBodyCell>

            <TableBodyCell tdClass="w-[25%] p-8">
              {#if $stores.stats[request.request_id]}
                <Table striped={true} border={1} class="rounded-xl border-2 border-gray-500 scale-[.9]">
                  <TableBody tableBodyClass="divide-y">
                    <TableBodyRow>
                      <TableBodyCell>Input Tokens</TableBodyCell>
                      <TableBodyCell>{$stores.stats[request.request_id].prompt_eval_count}</TableBodyCell>
                    </TableBodyRow>
                    <TableBodyRow>
                      <TableBodyCell>Output Tokens</TableBodyCell>
                      <TableBodyCell>{$stores.stats[request.request_id].eval_count}</TableBodyCell>
                    </TableBodyRow>
                    <TableBodyRow>
                      <TableBodyCell>Complete time</TableBodyCell>
                      <TableBodyCell><Badge>{($stores.stats[request.request_id].total_duration / 1e9).toFixed(2)}s</Badge></TableBodyCell>
                    </TableBodyRow>
                  </TableBody>
                </Table>
              {/if}
            </TableBodyCell>

            <TableBodyCell tdClass="w-[10%] text-center">
              <Button 
                class="mb-2 w-[130px] flex justify-between" 
                color="alternative" 
                size="xs" 
                on:click={() => openRequestModal(request.request_id)}>
                <ArchiveArrowDownSolid class="me-1 flex-2" />
                <span class="flex-1">Request</span>
              </Button>
              
              <Button 
                class="w-[130px] flex justify-between" 
                color="light" 
                size="xs" 
                on:click={() => openResponseModal(request.request_id)} 
                disabled={$stores.responses[request.request_id] == undefined}>
                <EyeSolid class="me-1" />
                <span class="flex-1">Response</span>
              </Button>
            </TableBodyCell>
          </TableBodyRow>

        {/each}
      </TableBody>
      {/if}
    </Table>
  </div>

  <!-- Request Modal -->
  <Modal title="View Request" bind:open={isRequestModalOpen} autoclose size="lg" placement="center" bodyClass={"p-0 space-y-4 flex-1 overflow-y-auto overscroll-contain"}>
    {#if $stores.requests[selectedRequestId]}
      <div class="json-cell">
        <JsonTree value={$stores.requests[selectedRequestId]} defaultExpandedLevel={5} shouldShowPreview={false} />
      </div>
    {/if}
  </Modal>

  <!-- Response Modal -->
  <Modal title="View Response" bind:open={isResponseModalOpen} autoclose size="md" placement="center" bodyClass={"p-0 space-y-4 flex-1 overflow-y-auto overscroll-contain"}>
    {#if $stores.responses[selectedRequestId]}
      <div class="markdown-body p-4">
        <SvelteMarkdown source={$stores.responses[selectedRequestId].message.content} />
      </div>
    {/if}
  </Modal>
</main>

<style>
  main {
    padding: 1rem;
  }

  .json-cell {
    @apply bg-blue-50 rounded p-4;
  }
</style>
