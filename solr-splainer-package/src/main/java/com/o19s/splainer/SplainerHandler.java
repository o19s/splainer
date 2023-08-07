/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.o19s.splainer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.apache.commons.io.IOUtils;
import org.apache.http.entity.ContentType;
import org.apache.lucene.util.ResourceLoader;
import org.apache.lucene.util.ResourceLoaderAware;
import org.apache.solr.api.Command;
import org.apache.solr.api.EndPoint;
import org.apache.solr.client.solrj.SolrRequest.METHOD;
import org.apache.solr.common.SolrException;
import org.apache.solr.common.SolrException.ErrorCode;
import org.apache.solr.common.params.CommonParams;
import org.apache.solr.common.params.ModifiableSolrParams;
import org.apache.solr.core.CoreContainer;
import org.apache.solr.core.SolrCore;
import org.apache.solr.handler.ReplicationHandler;
import org.apache.solr.request.SolrQueryRequest;
import org.apache.solr.response.SolrQueryResponse;
import org.apache.solr.security.PermissionNameProvider;

@EndPoint(
  method = METHOD.GET,
  path = "$path-prefix/*",
  permission = PermissionNameProvider.Name.CONFIG_READ_PERM
)
@RequiredArgsConstructor
public class SplainerHandler implements ResourceLoaderAware {
  @SuppressWarnings("unused")
  private final CoreContainer coreContainer;

  private ResourceLoader loader = null;

  @Override
  public void inform(ResourceLoader loader) {
    System.out.println("inform");
    this.loader = loader;
  }

  @Command
  public void call(SolrQueryRequest req, SolrQueryResponse rsp) throws IOException {
    System.out.println("Splainer: call" + req);
    String path = req.getHttpSolrCall().getPath();
    String filepath = resolveFilePath(path);

    final InputStream inputStream = loader.openResource(filepath);
    if (inputStream == null) {
      throw new SolrException(ErrorCode.NOT_FOUND, "File not found: " + filepath);
    }

    final byte[] data;
    final String contentType;

    if ("".equals(filepath)) {
      String indexPath = path.endsWith("/") ? path + "index.html" : path + "/index.html";
      indexPath = indexPath.replaceAll("____v2", "v2");
      data = ("<meta http-equiv=\"Refresh\" content=\"0; url='" + indexPath + "'\" />").getBytes(
        StandardCharsets.UTF_8);
      contentType = ContentType.TEXT_HTML.getMimeType();
    } else {
      data = IOUtils.toByteArray(inputStream);
      contentType = contentType(filepath);
    }
    final ModifiableSolrParams newParams = new ModifiableSolrParams(req.getOriginalParams());
    newParams.set(CommonParams.WT, ReplicationHandler.FILE_STREAM);
    req.setParams(newParams);

    final SolrCore.RawWriter writer = new SolrCore.RawWriter() {

      @Override
      public void write(OutputStream os) throws IOException {
        os.write(data);
      }

      @Override
      public String getContentType() {
        return contentType;
      }
    };

    rsp.add(ReplicationHandler.FILE_STREAM, writer);
  }

  private String contentType(final String filepath) {
    final Map<String, String> types = new HashMap<>();
    types.put("jpg", ContentType.IMAGE_JPEG.getMimeType());
    types.put("jpeg", ContentType.IMAGE_JPEG.getMimeType());
    types.put("png", ContentType.IMAGE_PNG.getMimeType());
    types.put("gif", ContentType.IMAGE_GIF.getMimeType());
    types.put("svg", ContentType.IMAGE_SVG.getMimeType());
    types.put("htm", ContentType.TEXT_HTML.getMimeType());
    types.put("html", ContentType.TEXT_HTML.getMimeType());
    types.put("json", ContentType.APPLICATION_JSON.getMimeType());
    types.put("xml", ContentType.APPLICATION_XML.getMimeType());
    types.put("js", "text/javascript");
    types.put("css", "text/css");

    final String extension = filepath.split("\\.")[filepath.split("\\.").length - 1];
    return types.getOrDefault(extension, "text/plain");
  }

  private String resolveFilePath(String path) {
    System.out.println("Splainer: resolveFilePath" + path);
    // Path can be: /____v2/splainer/index.html
    if (path.split("/").length < 3) {
      throw new SolrException(ErrorCode.BAD_REQUEST, "Can't parse path: " + path);
    }
    String basepath = "/" + path.split("/")[1] + "/" + path.split("/")[2];
    String filepath = path.substring(path.indexOf(basepath) + basepath.length());

    if (filepath.startsWith("/")) {
      filepath = filepath.substring(1);
    }
    return filepath;
  }
}
