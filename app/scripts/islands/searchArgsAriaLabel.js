/** `aria-label` strings for Search Args (Solr vs ES/OS). */
export function searchArgsAriaLabel(engine) {
  switch (engine) {
    case 'solr':
      return 'Solr query parameters';
    case 'es':
      return 'Elasticsearch query JSON body';
    case 'os':
      return 'OpenSearch query JSON body';
    default:
      return 'Search arguments';
  }
}
