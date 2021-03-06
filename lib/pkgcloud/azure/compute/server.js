/*
 * server.js: Azure Server
 *
 * (C) Microsoft Open Technologies, Inc.
 *
 */

var utile = require('utile'),
    base  = require('../../core/compute/server');

var Server = exports.Server = function Server(client, details) {
  base.Server.call(this, client, details);
  this.requestPending = false;
};

utile.inherits(Server, base.Server);

Server.prototype._setProperties = function (details) {
  var roleInstance = null;

  details = details || {};
  this.id   = details.Name || "";
  this.name   = details.Name || "";

  if(details.RoleInstanceList && details.RoleInstanceList.RoleInstance) {
    roleInstance = details.RoleInstanceList.RoleInstance;
  }

  //console.log("Status: " + details.Status + ' RoleInstanceList: ' + roleInstance ? roleInstance.InstanceStatus : 'UNKNOWN');

  // azure can return an inconsistent RoleInstance status (not in azure rest api docs) so we check everything.
  // an azure vm has a complicated state machine. We need to check the status of both the deployment and the role.
  // azure first starts a deployment and then starts a role. The role seems to go through STOPPEDVM, PROVISIONING and then
  // READYROLE.
  // Note: since azureAPI has to wait until azure responds to our createServer request, we most likely will miss all of the
  // deployment states unless something goes wrong
  // TODO: there doesn't seem to be an ERROR or FAIL status in pkgcloud

  if(roleInstance) {
    switch (roleInstance.InstanceStatus.toUpperCase()) {
      case 'PROVISIONING':
      case 'CREATINGVM':
      case 'STARTINGVM':
      case 'CREATINGROLE':
      case 'STARTINGROLE':
      case 'RESTARTINGROLE':
      case 'BUSYROLE':
      case 'INITIALIZING':
      case 'BUSY':
        this.status = 'PROVISIONING';
        break;
      case 'READYROLE':
      case 'READY':
        this.status = 'RUNNING';
        break;
      case 'STOPPING':
      case 'STOPPED':
      case 'STOPPINGROLE':
      case 'STOPPINGVM':
      case 'STOPPEDVM':
        this.status = 'STOPPED';
        break;
      case 'STOPPINGROLE':
      case 'STOPPINGVM':
      case 'STOPPEDVM':
        this.status = 'STOPPED';
        break;
      case 'DELETINGVM':
        this.status = 'TERMINATED';
        break;
      case 'ROLESTATEUNKNOWN':
      case 'UNKNOWN':
      default:
        this.status = 'UNKNOWN';
        break;
    }

  } else if (details.Status) {
    switch (details.Status.toUpperCase()) {
      case 'STARTING':
      case 'DEPLOYING':
      case 'PROVISIONING':
      case 'RUNNINGTRANSITIONING':
        this.status = 'PROVISIONING';
        break;
      case 'RUNNING':
        this.status = 'RUNNING';
        break;
      case 'SUSPENDING':
      case 'SUSPENDED':
      case 'SUSPENDEDTRANSITIONING':
        this.status = 'STOPPED';
        break;
      case 'DELETING':
        this.status = 'TERMINATED';
        break;
      default:
        this.status = 'UNKNOWN';
        break;
    }
  } else {
    this.status = 'UNKNOWN';
  }

  var addresses = { private: [], public: [] };

  // TODO: Need to clean up once I understand what is private ip?
  if(details.RoleInstanceList && details.RoleInstanceList.RoleInstance) {
    var ip =  details.RoleInstanceList.RoleInstance.IpAddress;
    addresses.public.push(ip);
    addresses.private.push(ip);
  } else {
    addresses.public.push('');
    addresses.private.push('');
  }
  this.addresses = details.addresses = addresses;

  if(details.RoleList && details.RoleList.Role) {
    if(details.RoleList.Role.OSVirtualHardDisk) {
      this.imageId = details.RoleList.Role.OSVirtualHardDisk.SourceImageName;
    }
  }

  this.serviceName = details.serviceName || details.Name;

  this.original = this.azure = details;
};
